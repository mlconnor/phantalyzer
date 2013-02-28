Phantalyzer is a PhantomJS based tool that leverages Wappalyzer to detect software in use across a large number of sites.  Wappalyzer is a browser plug-in so it's original design is to provide feedback from within the browser.  My intent here is to enable companies to analyze large numbers of sites and provide a report.  An example of this would be a report that indicates which sites are using Flash (and may need to be converted), which are not using proper analytics tags, etc.

Installation
You have to install phantomjs becuase this script depends on it.

Task List
- [ ] Figure out a way to leverage the Wappalyzer source files upstream rather than copy and paste them here as I've done.
- [ ] Enable a sophisticated input format that would enable you to specify User Agent and Locale at least on a site by site basis.
- [ ] Output to a decent format that could be converted to PDF or to Excel.
- [ ] Create more robust error handling.
- [ ] Provide a rich set of input options.
- [ ] Figure out an elegant way to do verbose output for diagnostics.
- [ ] Figure out how to do image captures in a configurable way.

This is how you would launch this beast.

phantomjs --web-security=false --load-images=yes phantalyzer.js http://www.slashdot.org http://www.cnn.com

Usage

The -f option gives you the ability to specify the csv file for the data.
The -n option is used to limit the number of sites visited.  Good for testing.

phantomjs --web-security=no phantalyzer.js -f sites.csv -n 10
