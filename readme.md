# How to Run

## Save to JSFiddle

```
node save-to-fiddle.js ...toSaveFile
```

## Load from JSFiddle

```
node load-from-fiddle.js reportFile.json
```

# Requirements

- [Node.js](https://nodejs.org/en/)
- [Chrome](https://www.google.com/intl/en_us/chrome/) and [ChromeDriver](https://chromedriver.chromium.org/)

# Limitations

- Please *** DO NOT *** change content of system clipboard while Running `save-to-fiddle.js`.  
  `save-to-fiddle.js` uses clipboard to input text editor area of JSFiddle.  

# 修正案

## 全体

ツールの .exe 化
 - 引数設定はどうする

## save-to-fiddle.js

 - save-to-fiddle.js で処理対象が大量になった場合も動作可能に
