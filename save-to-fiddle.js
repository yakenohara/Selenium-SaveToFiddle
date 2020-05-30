const fs = require('fs');
const path = require('path');
const {Builder, Button, Browser, By, Capabilities, Key} = require('selenium-webdriver');
const clipboardy = require('clipboardy');

// <Settings>--------------------------------------------
var str_browserName = Browser.CHROME;
var str_urlOfJSFiddle = 'https://jsfiddle.net';
var str_reportFile = 'save-report.json'
var bl_reBuildEveryAccess = false;

// <Tunings>----------------------
var int_waitMsForTextEditorLocated = 60000;
var int_waitMsForCaretLocated = 60000;
var int_tryTimesForClickTextEditor = 3;
var int_waitMsForSavedUrlGenerated = 60000;
var int_padding = 20;
// ---------------------</Tunings>
// -------------------------------------------</Settings>

var int_countOK = 0;
var int_countNG = 0;
var objarr_results = [];
var obj_webDriver;

(async function(){

    for(var int_idxOfArgs = 2 ; int_idxOfArgs < process.argv.length; int_idxOfArgs++){
        let str_arg = process.argv[int_idxOfArgs];
        console.log(`Processing ${int_idxOfArgs-1}of${(process.argv.length-2)} "${str_arg}"`);
    
        var obj_result = await (async function(){
    
            var obj_stat;
    
            // ファイル存在チェック
            try{
                obj_stat = fs.statSync(str_arg);
            
            }catch(e){
                if( // 存在しない場合
                    ((typeof e.code) != 'undefined') &&
                    (e.code === 'ENOENT')
                ){
                    let str_msg = `Cannot find "${str_arg}"`;
                    console.error(str_msg);
                    return {
                        "argument":str_arg,
                        "result":"NG",
                        "message":str_msg
                    };
                
                }else{ // Unkown Error
                    throw e;
                }
            }
    
            // 絶対パスの取得
            var str_absPathOfArg = path.resolve(str_arg);
            console.log(`Absolute path:"${str_absPathOfArg}"`);
            
            // ファイルかどうかチェック
            if(!obj_stat.isFile()){ //ファイルではない場合
                let str_msg = `Specified argument "${str_absPathOfArg}" is not representing file.`;
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }
    
            // Encode by base64
            var str_base64Encoded = fs.readFileSync(str_absPathOfArg, 'base64');
            // console.log(`str_base64Encoded:${str_base64Encoded}`);
    
            // Save to JSFiddle

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

            // Navigate
            console.log(`Accessing to ${str_urlOfJSFiddle}`);
            await obj_webDriver.get(str_urlOfJSFiddle);

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
            var objarr_elements = await obj_webDriver
                .wait(async function(){
                    var objarr_expectedAsEditorElements = await obj_webDriver
                        .findElements(
                            By.xpath(
                                `//div[@id="content"]` +
                                    `//div[${xPathPred_existsInClassList('panel-h')} and ${xPathPred_existsInClassList('panel')}]` +
                                        `//div[${xPathPred_existsInClassList('CodeMirror-scroll')}]`
                            )
                        )
                    ;
                    console.log(`objarr_expectedAsEditorElements.length:${objarr_expectedAsEditorElements.length}`);
                    if(objarr_expectedAsEditorElements.length < 3){
                        console.log(`Editors not found. Retry...`);
                        return false;
                    }
                    return objarr_expectedAsEditorElements;
                },int_waitMsForTextEditorLocated)
                .catch(function(e){
                    if( (typeof e) === 'object' && e.constructor.name === "TimeoutError"){
                        let str_msg = `Cannot find WebElement that repreesnts text editor.`
                        console.error(str_msg);
                        return {
                            "argument":str_arg,
                            "path":str_absPathOfArg,
                            "result":"NG",
                            "message":str_msg
                        };
                    
                    }else{
                        throw e;
                    }
                })
            ;

            var obj_actions = obj_webDriver.actions();

            // Click JavaScript Editor
            var bl_focused = await func_tryClickAndWaitCaret(objarr_elements[1], int_tryTimesForClickTextEditor);
            if(!bl_focused){
                let str_msg = `Caret not found`
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }

            // Save URL (1of2)
            var {beforeUrl, afterUrl} = await func_saveAndWaitUrl(int_waitMsForSavedUrlGenerated);
            if(!afterUrl){
                let str_msg = `Saving failded.`
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }

            console.log(`${padding('Saved URL', int_padding, ' ')}:${afterUrl}`);

            var str_urlDirNameL1 = afterUrl.replace(beforeUrl, '');
            str_urlDirNameL1 = str_urlDirNameL1.replace(/(.+)\//, '$1');
            
            // Clip text for HTML
            clipboardy.writeSync(
                `<div>` + str_urlDirNameL1 + `<div>`
            );

            // Click HTML Editor
            var bl_focused = await func_tryClickAndWaitCaret(objarr_elements[0], int_tryTimesForClickTextEditor);
            if(!bl_focused){
                let str_msg = `Caret not found`
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }

            // Paste to HTML Editor
            await obj_actions.clear();
            obj_actions
                .keyDown(Key.CONTROL)
                .sendKeys('v')
                .keyUp(Key.CONTROL)
            ;
            await obj_actions.perform();

            // Clip text for JavaScript
            clipboardy.writeSync(
                `/*` + str_base64Encoded + `*/`
            );

            // Click JavaScript Editor
            var bl_focused = await func_tryClickAndWaitCaret(objarr_elements[1], int_tryTimesForClickTextEditor);
            if(!bl_focused){
                let str_msg = `Caret not found`
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }

            // Paste to JavaScript Editor
            await obj_actions.clear();
            obj_actions
                .keyDown(Key.CONTROL)
                .sendKeys('v')
                .keyUp(Key.CONTROL)
            ;
            await obj_actions.perform();
            
            // Save URL (2of2)
            var {beforeUrl, afterUrl} = await func_saveAndWaitUrl(int_waitMsForSavedUrlGenerated);
            if(!afterUrl){
                let str_msg = `Saving failded.`
                console.error(str_msg);
                return {
                    "argument":str_arg,
                    "path":str_absPathOfArg,
                    "result":"NG",
                    "message":str_msg
                };
            }
            
            console.log(`${padding('Saved URL', int_padding, ' ')}:${afterUrl}`);
            
            return {
                "argument":str_arg,
                "path":str_absPathOfArg,
                "result":"OK",
                "message":'',
                "url": afterUrl
            };

            //
            // func_clickAndWaitCaret を指定回数 try する
            //
            async function func_tryClickAndWaitCaret(obj_element, int_maxTryTimes){
                for(let int_tryTimes = 0 ; int_tryTimes < int_maxTryTimes ; int_tryTimes++){
                    let lb_isFocused = await func_clickAndWaitCaret(obj_element, int_waitMsForCaretLocated);
                    if(lb_isFocused){
                        return true;
                    }
                }
                return false;
            }

            //
            // 指定 Text Editor をクリックしてキャレットが表示されるまで待つ。
            //
            async function func_clickAndWaitCaret(obj_element, int_waitMs){

                // Click Editor
                await obj_actions.clear();
                obj_actions
                    .move({
                        origin: obj_element
                    })
                    .press(Button.LEFT)
                    .release(Button.LEFT)
                ;
                await obj_actions.perform();

                // 親 node の class に `CodeMirror-focused` が追加されたことを確認する事で、
                // キャレット表示されたことを判定する
                var bl_focused = await obj_webDriver
                    .wait(async function(){

                        var obj_parentElem = await obj_element.findElement(By.xpath('./..'));
                        var str_clsNameOfParentElem = await obj_parentElem.getAttribute('class');
                        // console.log(`str_clsNameOfParentElem:${str_clsNameOfParentElem}`);
                        var strarr_clsNames = str_clsNameOfParentElem.split(' ');
                        for(let int_idxOfClsNames = 0 ; int_idxOfClsNames < strarr_clsNames.length ; int_idxOfClsNames++){

                            // 親 node の class に `CodeMirror-focused` が追加された
                            if(strarr_clsNames[int_idxOfClsNames] == 'CodeMirror-focused'){
                                return true;
                            }
                        }

                        console.log(`Caret not found. Waiting...`);
                        return false;

                    }, int_waitMs)
                    .catch(function(e){
                        if( (typeof e) === 'object' && e.constructor.name === "TimeoutError"){
                            console.warn(`Caret not found.`);
                            return false;
                        
                        }else{
                            throw e;
                        }
                    })
                ;

                return bl_focused;
            }
            
            //
            // Ctrl + s してから current url が更新されるまで待つ  
            // url が更新されたらその 更新前と更新後の url を返す
            //
            async function func_saveAndWaitUrl(int_waitMs){

                var str_urlBeforeSave = await obj_webDriver.getCurrentUrl();
                console.log(`${padding('URL before saving', int_padding, ' ')}:${str_urlBeforeSave}`);

                // Save by pressing Ctrl+s
                await obj_actions.clear();
                obj_actions
                    .keyDown(Key.CONTROL)
                    .sendKeys('s')
                    .keyUp(Key.CONTROL)
                ;
                await obj_actions.perform();

                var str_urlAfterSave = await obj_webDriver
                    .wait(async function(){
                        
                        var str_curUrl = await obj_webDriver.getCurrentUrl();
                        // console.log(`${padding('Current URL', int_padding, ' ')}:${str_curUrl}`);

                        // https://jsfiddle.net/c3d41uoz/ の `c3d41uoz` のように、ディレクトリが切られた URL になる事を確認する
                        var int_tmpIdx = str_curUrl.indexOf(str_urlBeforeSave);
                        if(
                            (int_tmpIdx != 0) || // 検索結果は先頭にないといけない
                            (str_curUrl.length == str_urlBeforeSave.length) 
                        ){
                            console.log(`Waiting for saved URL. Retry...`);
                            return false;
                        }

                        return str_curUrl; // 保存された URL を返す

                    }, int_waitMs)
                    .catch(function(e){
                        if( (typeof e) === 'object' && e.constructor.name === "TimeoutError"){
                            console.error('Timed out Generating saved url.');
                            return undefined;
                        
                        }else{
                            throw e;
                        }
                    })
                ;

                return {
                    beforeUrl:str_urlBeforeSave,
                    afterUrl:str_urlAfterSave
                };
            }

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

function padding(str_original, int_length, char_paddingChar){
    var int_len = getByteLen(str_original);
    if(int_len < int_length){
        return (str_original + char_paddingChar.repeat(int_length - int_len));
    }else{
        return str_original;
    }
}

function getByteLen(str) {
    var length = 0;
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if ((c >= 0x0 && c < 0x81) || (c === 0xf8f0) || (c >= 0xff61 && c < 0xffa0) || (c >= 0xf8f1 && c < 0xf8f4)) {
            length += 1;
        } else {
            length += 2;
        }
    }
    return length;
};
