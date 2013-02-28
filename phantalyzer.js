// https://github.com/bellbind/using-promise-q
// badass visualization, yslow, har files, etc. http://scriptogr.am/micmath/post/using-phantomjs-to-measure-web-page-performance

var      Q  = require('q');
var      S  = require('string');
var      U  = require('underscore');
var system  = require('system');
var     fs  = require('fs'); //http://code.google.com/p/phantomjs/source/browse/test/fs-spec-01.js?r=c22dfdc576fccd20db53e11a92cb349aa3cd0b2b

function csvToJson(str) {
  var data = [], i = 0, k = 0, header = [];
  var csvLines = CSVToArray(str);

  for ( i = 0; i < csvLines.length; i++ ) {
    var line = csvLines[i];
    if ( i == 0 ) {
      header = csvLines[i];
    } else {
      var obj = {};
      for ( k = 0; k < header.length; k++ ) {
        if ( k < csvLines[i].length ) {
          obj[header[k]] = csvLines[i][k];
        }
      }
      data.push(obj);
    }  
  }
  return data;
}

// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
function CSVToArray( strData, strDelimiter ){
  // Check to see if the delimiter is defined. If not,
  // then default to comma.
  strDelimiter = (strDelimiter || ",");

  // Create a regular expression to parse the CSV values.
  var objPattern = new RegExp(
      (
       // Delimiters.
       "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

       // Quoted fields.
       "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

       // Standard fields.
       "([^\"\\" + strDelimiter + "\\r\\n]*))"
      ),
      "gi"
      );

  // Create an array to hold our data. Give the array
  // a default empty first row.
  var arrData = [[]];

  // Create an array to hold our individual pattern
  // matching groups.
  var arrMatches = null;


  // Keep looping over the regular expression matches
  // until we can no longer find a match.
  while (arrMatches = objPattern.exec( strData )){

    // Get the delimiter that was found.
    var strMatchedDelimiter = arrMatches[ 1 ];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if (
	strMatchedDelimiter.length &&
	(strMatchedDelimiter != strDelimiter)
       ){

      // Since we have reached a new row of data,
      // add an empty row to our data array.
      arrData.push( [] );

    }

    // Now that we have our delimiter out of the way,
    // let's check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[ 2 ]){

      // We found a quoted value. When we capture
      // this value, unescape any double quotes.
      var strMatchedValue = arrMatches[ 2 ].replace(
	  new RegExp( "\"\"", "g" ),
	  "\""
	  );

    } else {

      // We found a non-quoted value.
      var strMatchedValue = arrMatches[ 3 ];

    }

    // Now that we have our value string, let's add
    // it to the data array.
    arrData[ arrData.length - 1 ].push( strMatchedValue );
  }

  // Return the parsed data.
  return( arrData );
}


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

    //console.log('RECEIVED ' + JSON.stringify(resource));

   /************************************************************************
    * we are going to check which kind of resource this is.  i break this
    * up into a few broad catgories that i care about.
    ************************************************************************/
    var typeCategories = {
      "Javascript" : /javascript/i,
      "Flash"      : /flash/i,
      "CSS"        : /css/i,
      "HTML"       : /html/i,
      "Video"      : /video/i,
      "Audio"      : /audio/i,
      "Images"     : /image/i,
      "Data"       : /(json|xm|csv)/i,
      "Other"      : /.?/
    };

    if ( U.has(resource, 'bodySize') && U.has(resource, 'contentType') ) {

      var category = U.find(U.keys(typeCategories), function(category) {
        //console.log('MATCH=' + category + " regex=" + typeCategories[category] + " CT=" + resource.contentType);
        var contentType = resource.contentType == null ? '' : resource.contentType;
        return contentType.match(typeCategories[category]);
      });
      //console.log("CAT=" + category + " RES=" + JSON.stringify(resource));
      if ( category ) {
        if ( ! U.has(destination.resourceTypes, category) ) {
          destination.resourceTypes[category] = resource.bodySize;
        } else {
          destination.resourceTypes[category] = resource.bodySize + destination.resourceTypes[category];
        }
      } else {
        console.log('Unable to resolve category for ' + resource.contentType);
      }
    }

    // we are trying to find the base page and determine
    // if the status code was successful
    if ( ! destination.pageBaseReached ) {
      var isRedirect = U.indexOf([301, 302, 303, 307, 308], resource.status) >= 0;
      if ( ! isRedirect ) {
        destination.pageBaseReached = true;
        if ( resource.status < 200 || resource.status > 226 ) {
          console.log("resourceReceived Error: " + JSON.stringify(resource));
          destination.error = true;
        } else {
          // found the base page
          destination.resolvedUrl = resource.url;  
          console.log("Found base page [" + resource.url + "] with HTTP Status " + resource.status);
          for (var i = 0; i < resource.headers.length; i++) {
            //console.log('HEADER=' + resource.headers[i].name + ': ' + resource.headers[i].value);
            destination.headers[resource.headers[i].name] = resource.headers[i].value;
          }
        }
      }
    }
  };
}

/**
 * Creates an onLoadFinished handler
 * for Phantom for a specific destination.
 */
function buildOnLoadFinished(page, destination) {
  return function(status) {

    if ( ! destination.error ) {
      console.log('onLoadFinished creating image file for dest ' + destination.url + ' while resolved is ' + destination.resolvedUrl);
      // create a file system friendly name for the url.
      // i originally wanted to use the resolved url but
      // if the page has an error then we don't get a resolved
      // url.  i think at some point we should move towards
      // resolved url but have to think through the edge cases.
      //destination.imageName = buildSlug(destination.url) + '.png';
      destination.imageName = buildSlug(destination.url) + '_' + new Date().getTime() + '.png';
      console.log('writing image for ' + destination.url + ' as ' + destination.imageName);
      page.render(outputDir + destination.imageName);
    }
  }
}

/**
 * String has a slugify() method
 */
function buildSlug(url) {
  return url.trim()
         .replace(/[^\w\s-]/g, '')
         .replace(/[-\s]+/g, '-')
         .toLowerCase()
         .replace(/^http/g, '');
} 

/**
 * This will create a destination for either a string url or an object
 * record that was read from disk. 
 */
function createDestination(site) {
  //console.log('CREATING SITE ' + JSON.stringify(site));
  var destination = {
    name           : "",
    url            : null,
    acceptLanguage : null,
    userAgent      : null,
    title          : "",
    resolvedUrl    : "",
    accessTime     : new Date().getTime(),
    pageLoadTime   : 0,
    error          : false,
    errorMsg       : "",
    imageName      : "",
    detected       : [],
    resourceTypes  : {},
    
    // anything below this line will is considered working variables that
    // will not be serialized.
    headers        : {}
  };

  // this will take the first four keys off the top.  these are the customizable fields.
  var customizableFields = U.keys(destination).slice(0,4);
  //console.log('custom fields=' + JSON.stringify(customizableFields));

  if ( U.isObject(site) ) {
    site = U.pick(site, customizableFields);
    U.extend(destination, site);
  } else {
    destination.url = site;
  }

  //console.log('SITE RESULT=' + JSON.stringify(destination));

  destination.pageBaseReached = false;
  return destination;
}  

var visit = function createPhantomPromise(destination) {
  var deferred = Q.defer();
  var page = require('webpage').create();
  page.customHeaders = { 'Accept-Encoding' : '' };

  if ( U.has(destination, 'userAgent') && U.isString(destination['userAgent']) && destination['userAgent'].trim().length > 0 ) {
    page.settings.userAgent = destination['userAgent'];
    console.log('Setting userAgent for site to ' + destination['userAgent']);
  } else {
    page.settings.userAgent = 'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27';
  }

  if ( U.has(destination, 'acceptLanguage') && U.isString(destination['acceptLanguage']) && destination['acceptLanguage'].trim().length > 0 ) {
    page.settings.userAgent = destination['acceptLanguage'];
    console.log('Setting acceptLanguage for site to ' + destination['acceptLanguage']);
  } else {
    page.settings.userAgent = 'en-us';
  }

  page.viewportSize = {                 width:1000, height:800 };
  page.clipRect     = { top: 0, left:0, width:1000, height:800 }; 
  page.onResourceReceived  = buildResourceReceived(page, destination);
  page.onResourceRequested = buildResourceRequested(page, destination);
  //page.onLoadFinished      = buildOnLoadFinished(page, destination);

  page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('        CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
  };
 
  var timerId = setTimeout(function() {
    console.log('closing page ' + destination.url + ' due to timeout');
    page.close();
    destination.error = "Timeout";
    deferred.resolve();
  }, 30000);
 
  destination.accessTime = new Date().getTime();

  page.open(destination.url, function(status) {
    clearTimeout(timerId);
    destination.pageLoadTime = (new Date().getTime()) - destination.accessTime;

    console.log('opened page ' + destination.url + ' status: ' + status + " Reporting error=" + destination.error + ' loadTime=' + destination.pageLoadTime + 'ms');

    destination.title = page.evaluate(function () {
      return document.title;
    });
    //destination.title = S(destination.title).decodeHTMLEntities().s;

    if ( destination.error ) {
      deferred.resolve();
      return;
    }

    page.injectJs('wappalyzer/wappalyzer.js');
    page.injectJs('wappalyzer/apps.js');
    page.injectJs('wappalyzer/driver.js');

    var fixedPageContent = fixNoScript(page.content);
    //console.log("PAGE IS " + fixedPageContent);

    var detectedApps = page.evaluate(function (dest, pageContent) {

      pageContent = document.getElementsByTagName('html')[0].innerHTML;
      //console.log(pageContent);
      //console.log('wap=' + wappalyzer.displayApps());
      //console.log('LAMBDA HEADERS=' + JSON.stringify(destination.headers));
  
      // the env property of wappalyzer is elusive because with phantomjs we
      // don't yet have the ability to get the source of all of the scripts
      // that are loaded without doing the work of going out separately to get them.
      // we can do that later but in the mean time we are going to pass in the source for all
      // of the script elements.

      var env = [];
      for(var env_var in window) { 
        if ( window.hasOwnProperty(env_var)) {
          env.push(env_var);
        } 
      }
      //console.log('ENV VARS=' + env);
      wappalyzer.analyze(dest.url, dest.url, {
        html: pageContent,
        headers: dest.headers,
        env: env
      });

      //console.log('HTML=' + document.getElementsByTagName('html')[0].innerHTML);
      console.log('[' + dest.url + '] finished with eval on wappalyzer');

      var apps = [];
      wappalyzer.detected[dest.url].map(function(app) {
        if ( wappalyzer.apps[app] ) {
          apps.push(app);
        }
      });

      // the return value has to be a primitive because
      // this shit is completely sandboxed.
      // i tried to JSON.stringify this but some of the sites
      // have hijacked stringify (prototype i think) and jacked it
      // up.  so i'm going to just do a join.
      return apps.join('|');
        
    }, destination, fixedPageContent);

    // so the return value here is a pipe separated string of apps that are
    // matching for the page.  let's go ahead and cram them back into the destination
    // so that when we write it back out we will have that info.
    destination.detected = detectedApps.split('|'); 

    destination.error = false;


    console.log('onLoadFinished creating image file for dest ' + destination.url + ' while resolved is ' + destination.resolvedUrl);
    // create a file system friendly name for the url.
    // i originally wanted to use the resolved url but
    // if the page has an error then we don't get a resolved
    // url.  i think at some point we should move towards
    // resolved url but have to think through the edge cases.
    // destination.imageName = buildSlug(destination.url) + '.png';
    window.setTimeout((function() {
      destination.imageName = buildSlug(destination.url) + '_' + new Date().getTime() + '.png';
      console.log('writing image for ' + destination.url + ' as ' + destination.imageName);
      page.render('data/' + destination.imageName);
      console.log('page open complete for ' + destination.url);
     
      page.close();
      deferred.resolve();
    }), 5000);
  });

  page.onError = function(msg, trace) {
    console.log('page threw an error with msg=' + msg + ' ' + JSON.stringify(trace));

    // i'm not sre
    //deferred.reject(msg);
    //page.close();
    destination.error = true;
    destination.errorMsg = msg;
  };
  console.log('lambda done for ' + destination.url);

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
  if ( ! matches ) {
    return content;
  }

  for ( var i = 0; i < matches.length; i++ ) {
    var decoded = S(matches[i]).decodeHTMLEntities().s;
    var index = content.indexOf(matches[i]);
    content = content.substring(0, index) + 
              decoded +
              content.substring(index + matches[i].length);
  }
  return content;
}

/**
 * let's process the argv.  i tried to use commander and optimist but they seem to be
 * hopelessly tied to node.js.  so i'm going to have to hack some crap here.
 */
function parseArgs() {
  var args = { map:{},v:[] };

  var argv = [];
  for ( var i = 1; i < system.args.length; i++ ) {
    if ( i < system.args.length - 1 && system.args[i].match(/^-.+/) ) {
      args.map[system.args[i].substring(1)] = system.args[i+1];
      i++;
    } else {
      args.v.push(system.args[i]);
    }
  }
  return args;
}

function getSiteList(args) {

  var destinations = [];

  if ( args.map['f'] ) {
    var siteFile = args.map['f'];

   // console.log(JSON.stringify(sites));

    // so they added a file.  let's read it

    if ( fs.exists(siteFile) ) {
      var csvData = fs.read(siteFile);
      var sites = csvToJson(csvData);
      var maxSites = sites.length;

      if ( U.has(args.map, 'n') ) {
        maxSites = Math.min(sites.length, parseInt(args.map['n']));
        console.log('Max sites set to process is ' + maxSites);
      }

      //console.log(JSON.stringify(sites));
      for ( var i = 0; i < maxSites; i++ ) {
        //var urlMatch = /(http|https):\/\/[^\s"',]+/gi;
        var site = sites[i];
        if ( U.has(site, 'url') && site['url'].match(/^http/i) ) {
          destinations.push(createDestination(sites[i]));
        } else {
          console.log('Skipping record because url does not start with http so it was assumed to be not valid ' + JSON.stringify(sites[i]));
        }
      }
    } else {
      throw 'unable to find data file ' + args.map['f'];
    }
  }

  console.log(JSON.stringify(destinations));

  // we are going to add each url passed on the command line to the todo list.
  args.v.forEach(function(element, index, array) {
    console.log('adding ' + element + ' to the data set');
    destinations.push(createDestination(element));
  });
  return destinations;
}

/****************************************************************************************************
 * Program start
 ****************************************************************************************************/

var args = parseArgs();
var siteInfo = getSiteList(args);
var outputDir = (U.has(args.map, 'd') ? args.map['d'] : './data') + '/';

if ( ! fs.exists(outputDir) ) {
  console.log('Fatal Error: the output directory ' + outputDir + ' does not exist');
  phantom.exit();
}  

//console.log(JSON.stringify(siteInfo));

var current = {};

// let's get rid of any sites that don't have a url
siteInfo = U.filter(siteInfo, function(site) {
  return site['url'] != null
      && U.isString(site['url'])
      && site['url'].match(/^\s*http/i); 
});

for ( var i = 0; i < siteInfo.length; i++ ) {
  if ( i == 0 ) {
    current = visit(siteInfo[i]);
  } else {
    // the promise construction requries us to return a function.
    // the infamous loop problem (http://robertnyman.com/2008/10/09/explaining-javascript-scope-and-closures/)
    // requires us to wrap *that* in a function to preserve the variable.
    // this may need to be revisited.  not suer if the inner is necessary.     
    current = current.then(
      function(site) {
        return function() {
          //console.log('url === ' + url);
          return visit(site);
        }
      }(siteInfo[i])
    );
  }
}

// let's write out all of the information we received
current.then(function() {
  console.log('wrapping up... writing files');

//  for ( var i = 0; i < siteInfo.length; i++ ) {
//    try {
//      console.log('writing results for ' + siteInfo[i].url + ' to disk...');
//      siteInfo[i] = U.pick(siteInfo[i], 'url', 'resolvedUrl', 'error', 'errorMsg', 'basePage', 'detected', 'accessTime', 'imageName','title');
 
      // TODO: figure out how to fix this...
//      if ( siteInfo[i].resolvedUrl == null ) {
//        siteInfo[i].resolvedUrl = siteInfo[i].url;
//      }

//      var outfile = fs.open('data/' + buildSlug(siteInfo[i].url) + '.json', "w");
//      outfile.write(JSON.stringify(siteInfo[i]));
//      outfile.close();
//    } catch (e) {
//      console.log('Exception thrown ' + e);
//    }
//  }


  try {
    var jsonOut = fs.open(outputDir + 'result.json', 'w');
    jsonOut.write(JSON.stringify(siteInfo));
    jsonOut.close();

    //var csvOut = fs.open('data/result.csv', 'w');
    //console.log(JSON.stringify(siteInfo));

    //U.each(siteInfo, function(site) {
    //  var vals = U.values(U.omit(site, 'headers'));
    //  console.log('writing result ' + JSON.stringify(site));
    //  csvOut.write(S(vals).toCSV().s + "\n");
    //});
    //csvOut.close();
  } catch (e) {
    console.log('exception thrown while writing csv file ' + e);
  }
    
  //console.log(JSON.stringify(siteInfo));

  //console.log(JSON.stringify(siteInfo));
  console.log('exiting...');
  phantom.exit();
});

console.log('all done');



