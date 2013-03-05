Phantalyzer is a PhantomJS based tool that leverages Wappalyzer to detect software in use across a large number of sites.  Wappalyzer is a browser plug-in so it's original design is to provide feedback from within the browser.  My intent here is to enable companies to analyze large numbers of sites and provide a report.  An example of this would be a report that indicates which sites are using Flash (and may need to be converted), which are not using proper analytics tags, etc.

After getting the Wappalyzer functionality up and running I added a few other features such as image capture for the site, site load time, and breakdown of resources loaded (HTML, CSS, etc).

The basic workflow is that you run the script with a CSV file input that provides sites.  The script runs and dumps images out and a resulting json file that contains info about the run.  You can then do whatever you want with that data.  

Report Script
I also incuded a file called report.php that reads the json file and generates a report of the run across all the sites.  I did this in PHP because I'm more comfortable in PHP but that script really should be built in JavaScript.  The output would render something that looks like this...

![reportimage](https://raw.github.com/mlconnor/phantalyzer/master/report_example.png)

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

Usage

The --sitefile option gives you the ability to specify the csv file for the data.
The --maxsites option is used to limit the number of sites visited.  Good for testing.
The --outputdir option is used to tell Phantalyzer where the result.json file and the images should be stored.
The --imgext option is used to tell Phantalyzer which image extension should be used.  png and jpg are supported.

phantomjs --web-security=no phantalyzer.js --sitefile sites.csv --maxsites 10 --outputdir ./data --imgext png
