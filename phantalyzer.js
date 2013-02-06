// good example on how to use q in node.js
// https://github.com/bellbind/using-promise-q
// badass visualization, yslow, har files, etc. http://scriptogr.am/micmath/post/using-phantomjs-to-measure-web-page-performance

var      Q = require('q');
var      S = require('string');
var      U = require('underscore');
var system = require('system');
//var program = require('commander');

var usage  = 'Usage: phantomjs phantalyzer.js <url[s]>';

if (system.args.length === 1) {
    console.log(usage);
    phantom.exit();
}

var sites = system.args.slice(1);

//program
//  .version('0.0.1')
//  .option('-u, --userAgent', 'Specify the User Agent that PhantomJS will use when making requests.')
//  .option('-P, --pineapple', 'Add pineapple')
//  .option('-b, --bbq', 'Add bbq sauce')
//  .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
//  .parse(process.argv);

/**
 * Lambda to build a handler for the PhantomJS
 * resource requested handler
 */
function buildResourceRequested(resourcePage, destination) {
  return function(resource) {
    //var mimeType = mime.lookup('htm');
    //console.log('Mime: ' + mimeType + ' URL=' + resource.url);
  }
}

/**
 * Lambda to build a handler for the PhantomJS
 * resource received handler
 */
function buildResourceReceived(resourcePage, destination) {
  return function(resource) {
    //var mimeType = Mime.lookup(resource.url);
    //console.log('Mime: ' + mimeType + ' URL=' + resource.url);

    //console.log('[' + resourcePage.url + '] resource ' + resource.url);
    if ( destination.pageReached === false && resource.status === 200) {
      destination.pageReached = true;
      console.log("Found base page [" + resource.url);
      for (var i = 0; i < resource.headers.length; i++) {
        //console.log('HEADER=' + resource.headers[i].name + ': ' + resource.headers[i].value);
        destination.headers[resource.headers[i].name] = resource.headers[i].value;
      }
      //console.log('HEADERS=' + JSON.stringify(destination.headers));
    }
  };
}

var visit = function createPhantomPromise(url) {
  var deferred = Q.defer();
  var destination = {
    url         : url,
    headers     : {},
    pageReached : false,
    error       : false
  }
  var page = require('webpage').create();
  page.settings.userAgent = 'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27';
  page.onResourceReceived = buildResourceReceived(page, destination);
  page.onResourceRequested = buildResourceRequested(page, destination);
  console.log('creating lambda for ' + url);

  page.onConsoleMessage = function(msg, lineNum, sourceId) {
    //console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
  };
 
  var timerId = setTimeout(function() {
    console.log('closing page ' + url + ' due to timeout');
    page.close();
    deferred.reject();
  }, 30000);
 
  page.open(url, function(status) {
    clearTimeout(timerId);
    console.log('opened page ' + url + ' status: ' + status);

    page.injectJs('wappalyzer.js');
    page.injectJs('apps.js');
    page.injectJs('driver.js');

    // create a file system friendly name for the url
    var slug = url.trim().replace(/[^\w\s-]/g, '').
               replace(/[-\s]+/g, '-').toLowerCase().
               replace(/^http/g, '');
    //page.render('img/' + slug + '.png');
    var title = page.evaluate(function () {
        return document.title;
    });

    var fixedPageContent = fixNoScript(page.content);
    //console.log("PAGE IS " + fixedPageContent);

    var detected = page.evaluate(function (destination, pageContent) {
      //console.log('INNER URL=' + destination.url + '============================================');
      console.log('calling analyze on the wappalyzer ====================================================================== ');
      //var pageData = document.getElementsByTagName('html')[0].innerHTML;
      //console.log('wap=' + wappalyzer.displayApps());
      //console.log('LAMBDA HEADERS=' + JSON.stringify(destination.headers));

      wappalyzer.analyze(destination.url, destination.url, {
        html: pageContent,
        headers: destination.headers,
        env: [  ]
      });

      //console.log('HTML=' + document.getElementsByTagName('html')[0].innerHTML);
      console.log('[' + destination.url + '] finished with eval on wappalyzer');

      var apps = [];
      wappalyzer.detected[destination.url].map(function(app) {
        if ( wappalyzer.apps[app] ) {
          apps.push(app);
        }
      });

      // the return value has to be a primitive because
      // this shit is completely sandboxed
      return JSON.stringify(apps);
        
    }, destination, fixedPageContent);

   console.log('det=' + detected);

    page.close();
    deferred.resolve();
  });

  page.onError = function(msg, trace) {
    console.log('page threw an error with msg=' + msg);
    deferred.reject(msg);
    page.close();
    destination.error = true;
  };
  console.log('lambda done for ' + url);

  return deferred.promise;
}

/**
 * There is a PhantomJS but that seems to 
 * escape the entities in the noscript tags.
 * This of course is where a lot of the analytics
 * sequences are found.  This function will return
 * them to their rightful form.
 */
function fixNoScript(content) {
  var noscript = /<\s*noscript\s*>([^<]+)<\s*\/\s*noscript\s*>/ig;
  var matches = content.match(noscript);
  for ( var i = 0; i < matches.length; i++ ) {
    var decoded = S(matches[i]).decodeHTMLEntities().s;
    var index = content.indexOf(matches[i]);
    content = content.substring(0, index) + 
              decoded +
              content.substring(index + matches[i].length);
  }
  return content;
}

//var sites = ['http://www.mycokerewards.com','http://www.facebook.com/cocacola', 'http://www.sprite.com', 'http://www.fanta.com'];

var current = {};

for ( var i = 0; i < sites.length; i++ ) {
  var thisUrl = sites[i];
  if ( i == 0 ) {
    current = visit(thisUrl);
  } else {
    // the promise construction requries us to return a function.
    // the infamous loop problem (http://robertnyman.com/2008/10/09/explaining-javascript-scope-and-closures/)
    // requires us to wrap *that* in a function to preserve the variable.
    // this may need to be revisited.  not suer if the inner is necessary.     
    current = current.then(
      function(url) {
        return function() {
          //console.log('url === ' + url);
          return visit(url);
        }
      }(thisUrl)
    );
  }
}

current.then(function() {
  console.log('exiting...');
  phantom.exit(); }
);
    
//visit('http://www.drudgereport.com').then(function() {
//  return visit('http://www.google.com');
//}).then(function() {
//  return visit('http://www.yahoo.com');
//}).then(function() {
//  return visit('http://www.slashdot.org');
//}).then(function() {
//  return visit('http://www.tamaraconnor.com');
//});
//visit('http://www.slashdot.org').then(visit('http://www.google.com'));


console.log('all done');
