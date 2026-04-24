const fs = require('fs');
const path = require('path');
const debugutil = require('./debugutil.js');
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

    // for(var int_idxOfArgs = 2 ; int_idxOfArgs < process.argv.length; int_idxOfArgs++){
    //     let str_arg = process.argv[int_idxOfArgs];
    //     console.log(`Processing ${int_idxOfArgs-1}of${(process.argv.length-2)} "${str_arg}"`);
    const strarr_filePath_in = fs.readFileSync(process.argv[2], 'utf-8').split('\r\n');
    for(var int_idxOfArgs = 0 ; int_idxOfArgs < strarr_filePath_in.length; int_idxOfArgs++){
        let str_arg = strarr_filePath_in[int_idxOfArgs];
        console.log(`Processing ${int_idxOfArgs+1}of${(strarr_filePath_in.length)} "${str_arg}"`);
    
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

            // note todo update
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
            async function fnc_a(){
                return (await obj_webDriver
                    .wait(async function(){
                        var objarr_expectedAsEditorElements = await obj_webDriver
                            .findElements(
                                By.xpath(
                                    `//main[@id="content"]` +
                                        `//div[${xPathPred_existsInClassList('panel-h')} and ${xPathPred_existsInClassList('panel')}]` +
                                            `//div[${xPathPred_existsInClassList('editor-scrollable')}]`
                                )
                                // By.xpath(
                                //     `//main[@id="content"]` +
                                //         `//div[${xPathPred_existsInClassList('panel-h')} and ${xPathPred_existsInClassList('panel')}]`
                                // )
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
                );
            }
            var objarr_elements = await fnc_a();

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

            objarr_elements = await fnc_a();

            var str_htmlContent = afterUrl.replace(beforeUrl, '');
            str_htmlContent = str_htmlContent.replace(/(.+)\//, '$1');
            str_htmlContent = `<div>${str_htmlContent}<div>`
            
            // Clip text for HTML
            await func_safeClipboardWrite(str_htmlContent);
            

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

            objarr_elements = await fnc_a();

            // Clip text for JavaScript
            await func_safeClipboardWrite(
                `var x='` + str_base64Encoded + `';`
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
            await obj_actions.clear(); //todo なぜかクリアされない場合あり
            obj_actions
                .keyDown(Key.CONTROL)
                .sendKeys('v')
                .keyUp(Key.CONTROL)
            ;
            await obj_actions.perform();

            objarr_elements = await fnc_a();

            await obj_webDriver
                .wait(async function(){
                    try{
                        var objarr_spanElements = await objarr_elements[1]
                            .findElements(
                                By.xpath(
                                    `.//div[${xPathPred_existsInClassList('view-lines')} and ${xPathPred_existsInClassList('monaco-mouse-cursor-text')}]` + 
                                        `//span[${xPathPred_existsInClassList('mtk1')}]`
                                )
                            )
                        ;
                        console.log(`objarr_spanElements.length:${objarr_spanElements.length}`);
                        if(objarr_spanElements.length < 1){
                            console.log(`Span not found. Retry...`);
                            return false;
                        }
                        var str_temp = await objarr_spanElements[0].getAttribute('innerHTML');
                        if (
                                ((typeof str_temp) !== 'string') || // `getAttribute()` 結果を返さない場合
                                (str_temp.length < 1)               // 貼り付けた文字列が見当たらない場合
                            ){
                            console.log(`Pasted string not found. Retry...`);
                            return false;
                        }
                    } catch(e) {
                        // 実行中に DOM が書き換わって StaleError になったら、
                        // return false して次のループ（再取得）に回す
                        if (e.name === 'StaleElementReferenceError') {
                            console.log(`StaleElementReferenceError. It seemed to pasting process is in process. Retry...`);
                            return false;
                        }
                        throw e;
                    }
                    return objarr_spanElements;
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

                // `.perform()` するので obj_element 参照先消される可能性あり。 -> 念のため xpath を取得しておく
                var str_xpathOfElement = await debugutil.getXPath(obj_webDriver, obj_element);

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

                // `.perform()` したので念のため取得し直し
                obj_element = await obj_webDriver
                    .wait(async function(){
                        var objarr_elements_remap = await obj_webDriver
                            .findElements(
                                By.xpath(str_xpathOfElement)
                            )
                        ;
                        console.log(`objarr_elements_remap.length:${objarr_elements_remap.length}`);
                        if(objarr_elements_remap.length < 1){
                            console.log(`Element ${str_xpathOfElement} not found. Retry...`);
                            return false;
                        }
                        return objarr_elements_remap[0];
                    },int_waitMs)
                ;

                // 親 node の class に `CodeMirror-focused` が追加されたことを確認する事で、
                // キャレット表示されたことを判定する
                var bl_focused = await obj_webDriver
                    .wait(async function(){

                        var obj_parentElem = await obj_element.findElement(By.xpath('./../..'));
                        var str_clsNameOfParentElem = await obj_parentElem.getAttribute('class');
                        // console.log(`str_clsNameOfParentElem:${str_clsNameOfParentElem}`);
                        var strarr_clsNames = str_clsNameOfParentElem.split(' ');
                        for(let int_idxOfClsNames = 0 ; int_idxOfClsNames < strarr_clsNames.length ; int_idxOfClsNames++){

                            // 親 node の class に `CodeMirror-focused` が追加された
                            if(strarr_clsNames[int_idxOfClsNames] == 'focused'){
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

            //
            // クリップボードへの書き込みをリトライ付きで実行する
            //
            async function func_safeClipboardWrite(str_text, int_numOfRetries = 60) {

                // OS ClipBoard に貼り付け
                for (let int_i = 0; int_i < int_numOfRetries; int_i++) {
                    try {
                        clipboardy.writeSync(str_text);
                        
                        // 2. 読み取って確認 (Verification)
                        let str_currentClipboard = clipboardy.readSync();
                        if (str_currentClipboard === str_text) {
                            // 内容が一致すれば成功
                            break;
                        } else {
                            // 書き込みエラーは出ていないが、中身が一致しない場合もリトライへ
                            console.warn(`Clipboard mismatch. Retrying... (${int_i + 1})`);
                        }
                    } catch (e) {
                        if (int_i === int_numOfRetries - 1) throw e; // 最後のリトライでもダメならエラーを投げる
                        console.warn(`Clipboard copy failed. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 待機
                    }
                }

                // <ClipBoard 文字列を Selenium が意図通り引っ張ってこれるかどうか確認>--------------------------------------------------------
                var str_id_tmp = `${func_checkclipboard.name}_0`;
                while(true){ // 存在しない id 名称を抽出するまで無限ループ
                    var obj_elems_expectedAs0 = await obj_webDriver.findElements(By.id(str_id_tmp));
                    if(obj_elems_expectedAs0.length === 0){
                        break;
                    }
                    var int_numOfRetry = parseInt((str_id_tmp.match(/_\d+$/))[0].replace(/^_/, '')) + 1;
                    str_id_tmp = str_id_tmp.replace(/_\d+$/, `_${int_numOfRetry.toString()}`);
                }
                var str_xpath_assertElem = `/div[@id="${str_id_tmp}"]`

                var objarr_expectedAsBody = await obj_webDriver.findElements(By.tagName('body'));
                var obj_expectedAsBody = objarr_expectedAsBody[0];

                var str_tmpElem = 
`<div id="${str_id_tmp}" style="user-select: text; align-items: center; background: rgba(0, 0, 0, .75); bottom: 0; display: flex; justify-content: center; left: 0; position: fixed; right: 0; top: 0; color: #000000">
    <div class="modal-container" style="background: #fff; border-radius: 4px; padding: 30px 20px; overflow: auto; 
        /* 横幅の設定 */
        width: 80%; 
        max-width: 80%; 
        /* 高さの設定 */
        height: 80%;
        max-height: 80%;
        /* 中身を広げるための設定 */
        display: flex;
        flex-direction: column;">

        <textarea style="box-sizing: border-box; width: 100%; height: 100%; flex-grow: 1; resize: none; background-color:#fff; color:#000000;
            /* 横に長くても改行させない設定 */
            white-space: nowrap; 
            /* 横スクロールバーを必要に応じて表示 */
            overflow: auto;""></textarea>
    </div>
</div>
`
                ;

                await obj_webDriver.executeScript(
                    "document.body.insertAdjacentHTML('beforeend', arguments[0]);", 
                    str_tmpElem
                );
                var obj_elems_expectedAsTextArea = await obj_webDriver.findElements(By.xpath(`//body/div[@id="${str_id_tmp}"]//textarea`));
                obj_elems_expectedAsTextArea = obj_elems_expectedAsTextArea[0];

                // Click textarea
                var int_timeOfTryClick = 0;
                for(int_timeOfTryClick = 0 ; int_timeOfTryClick < int_tryTimesForClickTextEditor ; int_timeOfTryClick++){
                    await obj_actions.clear();
                    await obj_elems_expectedAsTextArea.click();
                        //Note:
                        // <div> 要素を上記 `.executeScript()` で追加しても、 
                        // jsfiddle.net 側の既存の要素が追加した要素の更に手前に表示される。
                        // `.move()` -> `.press()` -> `.release()` でクリックさせる場合に邪魔する可能性がありそうなので、
                        // ここでは `.click()` を仕様
                    var bl_isFocused = await obj_webDriver.executeScript(
                        `return document.activeElement === arguments[0];`, 
                        obj_elems_expectedAsTextArea
                    );
                    if(bl_isFocused){ // <textarea> にフォーカスされた = キャレットが表示された場合
                        break;
                    }
                    console.log(`Caret not found. Retry...`);
                }
                if(int_timeOfTryClick >= int_tryTimesForClickTextEditor){
                    let str_msg = `Caret not found`
                    throw(new Error(str_msg, {
                        details: {
                            "argument":str_arg,
                            "path":str_absPathOfArg,
                            "result":"NG",
                            "message":str_msg
                        }
                    })); //todo 受け取り側でハンドリング
                }

                // Paste to textarea
                await obj_actions.clear();
                obj_actions
                    .keyDown(Key.CONTROL)
                    .sendKeys('v')
                    .keyUp(Key.CONTROL)
                ;
                await obj_actions.perform();

                // 文字列が一致するかどうか確認
                obj_elems_expectedAsTextArea = await obj_webDriver.findElements(By.xpath(`//body/div[@id="${str_id_tmp}"]//textarea`)); // 一応とりなおし
                obj_elems_expectedAsTextArea = obj_elems_expectedAsTextArea[0];

                var str_pasted = await obj_elems_expectedAsTextArea.getAttribute('value');

                //todo str_pasted が違った場合の処理

                // 追加した element を削除
                await obj_webDriver.executeScript(
                    `document.getElementById(arguments[0]).remove();`,
                    str_id_tmp
                );

                // --------------------------------------------------------<ClipBoard 文字列を Selenium が意図通り引っ張ってこれるかどうか確認>
            }

            //
            // `obj_webDriver.actions()` で ctrl+v の結果、clipboard の文字列が貼り付けられるかどうか確認
            //
            async function func_checkclipboard(str_expected){

                var str_id_tmp = `${func_checkclipboard.name}_0`;
                while(true){ // 存在しない id 名称を抽出するまで無限ループ
                    var obj_elems_expectedAs0 = await obj_webDriver.findElements(By.id(str_id_tmp));
                    if(obj_elems_expectedAs0.length === 0){
                        break;
                    }
                    var int_numOfRetry = parseInt((str_id_tmp.match(/_\d+$/))[0].replace(/^_/, '')) + 1;
                    str_id_tmp = str_id_tmp.replace(/_\d+$/, `_${int_numOfRetry.toString()}`);
                }
                var str_xpath_assertElem = `/div[@id="${str_id_tmp}"]`

                var objarr_expectedAsBody = await obj_webDriver.findElements(By.tagName('body'));
                var obj_expectedAsBody = objarr_expectedAsBody[0];

                var str_tmpElem = 
`<div id="${str_id_tmp}" style="user-select: text; align-items: center; background: rgba(0, 0, 0, .75); bottom: 0; display: flex; justify-content: center; left: 0; position: fixed; right: 0; top: 0; color: #000000">
    <div class="modal-container" style="background: #fff; border-radius: 4px; padding: 30px 20px; overflow: auto; 
        /* 横幅の設定 */
        width: 80%; 
        max-width: 80%; 
        /* 高さの設定 */
        height: 80%;
        max-height: 80%;
        /* 中身を広げるための設定 */
        display: flex;
        flex-direction: column;">

        <textarea style="box-sizing: border-box; width: 100%; height: 100%; flex-grow: 1; resize: none; background-color:#fff; color:#000000;
            /* 横に長くても改行させない設定 */
            white-space: nowrap; 
            /* 横スクロールバーを必要に応じて表示 */
            overflow: auto;""></textarea>
    </div>
</div>
`
                ;

                await obj_webDriver.executeScript(
                    "document.body.insertAdjacentHTML('beforeend', arguments[0]);", 
                    str_tmpElem
                );
                var obj_elems_expectedAsTextArea = await obj_webDriver.findElements(By.xpath(`//body/div[@id="${str_id_tmp}"]//textarea`));
                obj_elems_expectedAsTextArea = obj_elems_expectedAsTextArea[0];

                // Click textarea
                for(let int_timeOfTryClick = 0 ; int_timeOfTryClick < int_tryTimesForClickTextEditor ; int_timeOfTryClick++){
                    await obj_actions.clear();
                    await obj_elems_expectedAsTextArea.click();
                        //Note:
                        // <div> 要素を上記 `.executeScript()` で追加しても、 
                        // jsfiddle.net 側の既存の要素が追加した要素の更に手前に表示される。
                        // `.move()` -> `.press()` -> `.release()` でクリックさせる場合に邪魔する可能性がありそうなので、
                        // ここでは `.click()` を仕様
                    var bl_isFocused = await obj_webDriver.executeScript(
                        `return document.activeElement === arguments[0];`, 
                        obj_elems_expectedAsTextArea
                    );
                    if(bl_isFocused){ // <textarea> にフォーカスされた = キャレットが表示された場合
                        break;
                    }
                    console.log(`Caret not found. Retry...`);
                }

                // Paste to textarea
                await obj_actions.clear();
                obj_actions
                    .keyDown(Key.CONTROL)
                    .sendKeys('v')
                    .keyUp(Key.CONTROL)
                ;
                await obj_actions.perform();

                // 文字列が一致するかどうか確認
                obj_elems_expectedAsTextArea = await obj_webDriver.findElements(By.xpath(`//body/div[@id="${str_id_tmp}"]//textarea`)); // 一応とりなおし
                obj_elems_expectedAsTextArea = obj_elems_expectedAsTextArea[0];

                var str_pasted = await obj_elems_expectedAsTextArea.getAttribute('value');

                console.log(str_pasted===str_expected);

                // 追加した element を削除
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

