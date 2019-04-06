require("dotenv").config();
var twilio = require('twilio');
var express = require("express");
var bodyParser = require("body-parser");

var Imap = require("imap");
var inspect = require("util").inspect;
var fs = require("fs"), fileStream;

var imap = new Imap({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PWD,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    tls: true
});

// Twilio Stuff------------------------------------------------------------------------------------------------------------------
var sid = process.env.TWILIO_SID;
var token = process.env.TWILIO_TOKEN;
var client = new twilio(sid, token);
// end Twilio Stuff---------------------------------------------------------------------------------------------------------

var app = express();
var PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

var syncOptions = { force: false };

// If running a test, set syncOptions.force to true
// clearing the `testdb`
if (process.env.NODE_ENV === "test") {
    syncOptions.force = true;
}

// Starting the server ------------------------------------/
app.listen(PORT, function () {
    // Routes
    app.get("/", function (req, res) {
        res.send("<h1>Hit the email to text page!</h1>");
        console.log("the / route was hit!")
    });
    console.log(
        `==> 🌎  Listening on port %s. Visit ${process.env.BASE_URL} in your browser.`,
        PORT,
        PORT
    );
});

// keep app alive on heroku -- since heroku sleeps all apps with 1 hour of inactivity!
var http = require("http");
setInterval(function () {
    http.get(process.env.BASE_URL);
}, 300000); // every 5 minutes (300000)

function openInbox(cb) {
    imap.openBox("INBOX", true, cb);
}
imap.once("ready", function () {
    var found = false;
    curInterval = setInterval(function () {
        openInbox(function (err, box) {
            if (err) throw err;
            imap.search(["UNSEEN", ["SINCE", "April 3, 2019"], ["SUBJECT", "An Earlier Appointment Has Become Available!"]], function (err, results) {
                // if (err) throw err;
                if (err) console.log("Error: " + err);
                console.log("RESULTS ==> " + results)
                if (results != "") {
                    // send out the text
                    if (!found) {
                        // send text with Twilio
                        client.messages.create({
                            to: process.env.PHONE_NUMBER,
                            from: '+16307915544', // Don't touch me!
                            body: "Hurry, there is an appointment available!!"
                        });
                    }
                    // set found to true to avoid repeated texts
                    found = true;

                    var f = imap.fetch(results, { bodies: "TEXT" });
                    f.on("message", function (msg, seqno) {
                        console.log("Message #% d", seqno);
                        var prefix = "(#" + seqno + ") ";
                        // msg.on("body", function (stream, info) {
                        //     console.log(prefix + "Body" + "-->" + JSON.stringify(stream));
                        //     stream.pipe(fs.createWriteStream("msg -" + seqno + "-body.txt"));
                        // });
                        msg.once("attributes", function (attrs) {
                            console.log(prefix + "Attributes: % s", inspect(attrs, false, 8));
                        });
                        msg.once("end", function () {
                            console.log(prefix + "Finished");
                        });
                    });
                    f.once("error", function (err) {
                        console.log("FETCH error: " + err);
                    });
                    // f.once("end", function () {
                    //     console.log("Done fetching all messages!");
                    //     imap.end();
                    // });
                    f.on("mail", function (numMessages) {
                        console.log("==> " + numMessages + " new messages arrived!")
                    });
                } else {
                    found = false;    // reset since this would imply the email has been read/deleted/acknowledged
                }
            });
        })
    }, 30000)
});
imap.once("error", function (err) {
    console.log(err);
});
imap.once("end", function () {
    console.log("Connection ended");
});
imap.once("mail", function (numMessages) {
    console.log("==> Found " + numMessages + " to search!")
});
imap.connect();



module.exports = app;
