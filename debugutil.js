/**
 * WebElement から XPath を取得する関数 (デバッグ用)
 * @param {WebDriver} driver 
 * @param {WebElement} element 
 * @returns {Promise<string>}
 */
async function getXPath(driver, element) {
    return await driver.executeScript(`
        var getElementXPath = function(element) {
            if (element && element.id) {
                return '//*[@id="' + element.id + '"]';
            }
            var paths = [];

            // document.evaluate が使える環境で、ルート(HTML)まで遡る
            for (; element && element.nodeType == 1; element = element.parentNode) {
                var index = 0;
                for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                    // テキストノードなどを除外
                    if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
                    if (sibling.nodeName == element.nodeName) ++index;
                }
                var tagName = element.nodeName.toLowerCase();
                var pathIndex = (index ? '[' + (index + 1) + ']' : '');
                paths.splice(0, 0, tagName + pathIndex);
            }

            return paths.length ? '/' + paths.join('/') : null;
        };
        return getElementXPath(arguments[0]);
    `, element);
}
module.exports = {
    getXPath: getXPath
};
