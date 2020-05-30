const fs = require('fs');
const path = require('path');
const {Builder, Button, Browser, By, Capabilities, Key} = require('selenium-webdriver');

// <Settings>--------------------------------------------
var str_browserName = Browser.CHROME;
var str_urlOfJSFiddle = 'https://jsfiddle.net';
var str_outDirName = 'load-files';
var str_reportFile = 'load-report.json'
var bl_reBuildEveryAccess = false;

// <Tunings>----------------------
var int_waitMsForResultLocated = 60000;
var int_waitMsForScriptLocated = 60000;
// ---------------------</Tunings>
// -------------------------------------------</Settings>

// Argument check
if(process.argv.length < 3){
    console.error('Report file required.');
    return;
}
var str_arg = process.argv[2];
var obj_stat;

// ファイル存在チェック
try{
    obj_stat = fs.statSync(str_arg);

}catch(e){
    if( // 存在しない場合
        ((typeof e.code) != 'undefined') &&
        (e.code === 'ENOENT')
    ){
        console.error(`Cannot find "${str_arg}"`);
        return;
    
    }else{ // Unkown Error
        throw e;
    }
}

// 絶対パスの取得
var str_absPathOfArg = path.resolve(str_arg);
console.log(`Absolute path:"${str_absPathOfArg}"`);

// ファイルかどうかチェック
if(!obj_stat.isFile()){ //ファイルではない場合
    console.error(`Specified argument "${str_absPathOfArg}" is not representing file.`);
    return;
}

var objarr_savedUrls = JSON.parse(fs.readFileSync(str_absPathOfArg, 'utf8'));

//ディレクトリ解析
var str_commonPath;
var str_root;
var bl_isFirstLoop = true;
var bl_multiRoot = false;
objarr_savedUrls.forEach(function(obj_result){
    
    // 有効ファイルチェック
    if(typeof obj_result['path'] != 'string'){ // 保存元ファイルのパスがない
        return;
    }

    var obj_parsedPath = path.parse(obj_result['path']); // TypeError の可能性
    
    if(bl_isFirstLoop){
        str_root = obj_parsedPath.root;
        str_commonPath = obj_parsedPath.dir.substring(obj_parsedPath.root.length, obj_parsedPath.dir.length);;
        bl_isFirstLoop = false;
        
    }else{

        if(str_root != obj_parsedPath.root){ // ドライブが別
            bl_multiRoot = true;
        }

        let str_ttt = obj_parsedPath.dir.substring(obj_parsedPath.root.length, obj_parsedPath.dir.length);;
        let int_maxLen = (str_commonPath.length < str_ttt.length) ? str_commonPath.length : str_ttt.length ;
        for(var int_i = 0 ; int_i < int_maxLen ; int_i++){
            
            if(str_commonPath.substring(int_i, int_i+1) != str_ttt.substring(int_i, int_i+1)){
                break;
            }
        }
        str_commonPath = str_commonPath.substring(0, int_i);
    }
});

// console.log(`bl_multiRoot:${bl_multiRoot}`);
// console.log(`str_commonPath:${str_commonPath}`);

var int_countOK = 0;
var int_countNG = 0;
var objarr_results = [];
var obj_webDriver;

(async function(){

    for(let int_idxOfUrl = 0 ; int_idxOfUrl < objarr_savedUrls.length ; int_idxOfUrl++){
        let obj_url = objarr_savedUrls[int_idxOfUrl];

        console.log(`Processing ${int_idxOfUrl+1}of${(objarr_savedUrls.length)}`);

        var obj_result = await (async function(){

            if(
                (typeof obj_url['path'] != 'string') || // 保存元ファイルのパスがない
                (typeof obj_url['url'] != 'string')        // 保存先 URL がない
            ){
                let str_msg = `Expected property "path" or "url" not found.`;
                console.error(str_msg);
                return {
                    "result":"NG",
                    "message":str_msg
                };
            }

            var str_savedUrl = obj_url['url'];

            if(bl_reBuildEveryAccess){
                // すでにブラウザを開いていたら、閉じる
                if((typeof obj_webDriver) === 'object' && obj_webDriver.constructor.name === 'Driver'){
                    await obj_webDriver.quit();
                    obj_webDriver = undefined;
                }
            }

            if(typeof obj_webDriver == 'undefined'){
    
                // Create WebDriver object
                obj_webDriver = await new Builder()
                    .withCapabilities(
                        new Capabilities()
                            .setBrowserName(str_browserName)
                    )
                    .build()
                ;
        
                // Set screen resolution as XGA size
                await obj_webDriver.manage().window().setRect({
                    width:1024,
                    height:768
                });
            }

            // Check URL string
            if( str_savedUrl.indexOf(str_urlOfJSFiddle) != 0){ // JSFiddle の URL ではない場合
                let str_msg = `Saved URL "${str_savedUrl}" does not represents JSFiddle.`;
                console.error(str_msg);
                return {
                    "url":str_savedUrl,
                    "result":"NG",
                    "message":str_msg
                };
            }

            // Navigate
            console.log(`Accessing to ${str_savedUrl}`);
            await obj_webDriver.get(str_savedUrl);

            // note
            //
            // <div id="content">
            //     <div class="panel-v left">
            //         <div class="panel-h panel">
            //             <div class="CodeMirror cm-s-default CodeMirror-wrap fontSize_1">
            //                 <div class="CodeMirror-scroll">   // <- HTML
            //         <div class="gutter gutter-vertical">
            //         <div class="panel-h panel">
            //             <div class="CodeMirror cm-s-default CodeMirror-wrap fontSize_1">
            //                 <div class="CodeMirror-scroll">   // <- JavaScript
            //     <div class="gutter gutter-horizontal">
            //     <div class="panel-v right">
            //         <div class="panel-h panel">
            //             <div class="CodeMirror cm-s-default CodeMirror-wrap fontSize_1">
            //                 <div class="CodeMirror-scroll">   // <- CSS
            //         <div class="gutter gutter-vertical">
            //         <div class="panel-h panel resultsPanel">  // <- Result
            //
            var obj_resultElem = await obj_webDriver
                .wait(async function(){
                    var objarr_expectedAsResultElements = await obj_webDriver
                        .findElements(
                            By.xpath(
                                `//div[@id="content"]` +
                                    `//div[${xPathPred_existsInClassList('panel-h')} and ${xPathPred_existsInClassList('panel')} and ${xPathPred_existsInClassList('resultsPanel')}]`
                            )
                        )
                    ;
                    console.log(`objarr_expectedAsResultElements.length:${objarr_expectedAsResultElements.length}`);
                    if(objarr_expectedAsResultElements.length < 1){
                        console.log(`Results not found. Retry...`);
                        return false;
                    }
                    return objarr_expectedAsResultElements[0];
                },int_waitMsForResultLocated)
                .catch(function(e){
                    if( (typeof e) === 'object' && e.constructor.name === "TimeoutError"){
                        let str_msg = `Cannot find WebElement that repreesnts Result.`
                        return undefined;
                    
                    }else{
                        throw e;
                    }
                })
            ;
            if(!obj_resultElem){
                let str_msg = `<div class="panel-h panel resultsPanel"> not found.`;
                console.error(str_msg);
                return {
                    "url":str_savedUrl,
                    "result":"NG",
                    "message":str_msg
                };
            }
            var obj_scriptElem = await obj_webDriver
                .wait(async function(){

                    var obj_expectedAsIFrame = await obj_resultElem
                        .findElements(
                            By.xpath(`.//iframe`)
                        )
                    ;
                    console.log(`obj_expectedAsIFrame.length:${obj_expectedAsIFrame.length}`);
                    if(obj_expectedAsIFrame.length < 1){
                        console.log(`<iframe> not found. Retry...`);
                        return false;
                    }

                    await obj_webDriver.switchTo().frame(obj_expectedAsIFrame[0]);
                    var obj_expectedAsScriptElem = await obj_webDriver
                        .findElements(
                            By.xpath(`//body//script[@type="text/javascript"]`)
                        )
                    ;
                    console.log(`obj_expectedAsScriptElem.length:${obj_expectedAsScriptElem.length}`);
                    if(obj_expectedAsScriptElem.length < 1){
                        console.log(`<script> not found. Retry...`);
                        return false;
                    }
                    return obj_expectedAsScriptElem[0];

                },int_waitMsForScriptLocated)
                .catch(function(e){
                    if( (typeof e) === 'object' && e.constructor.name === "TimeoutError"){
                        console.error('Timed out Generating saved url.');
                        return undefined;
                    
                    }else{
                        throw e;
                    }
                })
            ;
            if(!obj_scriptElem){
                let str_msg = `<script> not found.`;
                console.error(str_msg);
                return {
                    "url":str_savedUrl,
                    "result":"NG",
                    "message":str_msg
                };
            }

            var str_temp = await obj_scriptElem.getAttribute('innerHTML');
            
            // Search base64 encoded string
            // save-to-fiddle.js で /* */ コメントアウトしているので、これを探す。
            var strarr_commentouted = str_temp.match(/\/\*(.+)\*\//g);
            if(
                (typeof strarr_commentouted === null) || // 文字列が見つからなかった場合
                (strarr_commentouted.length != 1)
            ){
                let str_msg = `Encoded string not found.`;
                console.error(str_msg);
                return {
                    "url":str_savedUrl,
                    "result":"NG",
                    "message":str_msg
                };
            }

            // Extract base64 encoded string
            var str_base64Encoded = strarr_commentouted[0].replace(/\/\*(.+)\*\//g, '$1');
            var obj_bf = new Buffer.from(str_base64Encoded,'base64');

            var obj_pathBeforeSave = path.parse(obj_url['path']);

            var str_temp2 = obj_pathBeforeSave.dir.replace(obj_pathBeforeSave.root, ''); // root 文字列の削除
            str_temp2 = str_temp2.replace(str_commonPath, ''); // 共通 path の削除

            // ファイル保存先ディレクトリ文字列の生成
            var str_pathOfOutDir = 
                path.resolve(`./${str_outDirName}`) +
                (bl_multiRoot ? path.sep + (obj_pathBeforeSave.root.replace(':','').replace(path.sep, '')) : '') +
                str_temp2
            ;
            if (!fs.existsSync(str_pathOfOutDir)) { // ディレクトリが存在しないとき
                fs.mkdirSync(str_pathOfOutDir, { recursive: true });
            }

            // Save as file
            var str_absPathOfResult = str_pathOfOutDir + path.sep + obj_pathBeforeSave.base;
            fs.writeFile(str_absPathOfResult, obj_bf, function(e){if(e){throw e}});
            
            return{
                "url":str_savedUrl,
                "result":"OK",
                "path":str_absPathOfResult
            };

        })();

        if(obj_result.result !== "OK"){
            int_countNG++;
        }else{
            int_countOK++;
        }
        objarr_results.push(obj_result);
        
    }

    console.log('');
    console.log('Done!');
    console.log('');
    console.log('-----------<RESULT>-----------');
    console.log(`TOTAL:${(int_countOK+int_countNG)}`);
    console.log(`OK:${int_countOK}`);
    console.log(`NG:${int_countNG}`);
    console.log('');

    var str_absPathOfResult = path.resolve(str_reportFile);
    fs.writeFile(str_absPathOfResult, JSON.stringify(objarr_results, null, '    '), function(e){if(e){throw e}});
    console.log(`Report saved as "${str_absPathOfResult}"`)

})();

function xPathPred_existsInClassList(str_className){
    return `contains(concat(" ",@class," "), " ${str_className} ")`;
}
