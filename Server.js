var Promises = require("bluebird");
var admin = require("firebase-admin");
var express = require("express");
var cors = require("cors");
var app = express();
var bodyParser = require('body-parser')
var serviceAccount = require("./s.json");

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://wispero-921f9.firebaseio.com"
});

var db = admin.database();
var ref = db.ref("/");

//to get snapshot of the database

/*ref.once("value", function(snapshot) {
  console.log(snapshot.val());
});*/

//var uid = "KaZnhyEsjcaoaVYKETA2oczEOgP2";
//get user records by the UID obtained after decoding the ID token received via the request from the client( Expert Device)
var getRecordByUID = function(uid)
{
  return new Promises(function(resolve,reject){

    admin.auth().getUser(uid)
    .then(function(userRecord) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully fetched user data\n"+userRecord.toJSON().email);
      resolve(userRecord.toJSON().email);
    })
    .catch(function(error) {
      console.log("Error fetching user data:",);
      reject(null);
    });

  })
}

//var email = "abc@gmail.com"

//get user records by the email ID to verify ...
var getRecordByEmail = function(email)
{
  return new Promises(function(resolve,reject)
  {
    admin.auth().getUserByEmail(email)
    .then(function(userRecord) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully fetched user data\n");
      resolve(userRecord.toJSON().uid);
    })
    .catch(function(error) {
      console.log("Error fetching user data:", );
      reject(null);
    });

  })
}


var verifyAndGetUID = function(IDtoken)
{
  return new Promises(function(resolve,reject){

    admin.auth().verifyIdToken(IDtoken)
      .then(function(decodedToken) {
      var uid = decodedToken.uid;
      resolve(uid);
    }).catch(function(error) {
      console.log("UID not Present. Breach Alert\n");
      reject(null);
    });

  })
}

var newClient = function(UID,regToken)
{
    var ref = db.ref("/");
    var ScoRef = ref.child("Scout");

    return new Promises(function(resolve,reject){
      ScoRef.child(UID).once('value',function(snapshot){
        var userRecordPresent = (snapshot.val()!==null);
        resolve(userRecordPresent);
    }).then(function(userRecordPresentBool){
      if(!userRecordPresentBool)
      {
        ScoRef.update({
          [UID]:{
            appConfig:{
              regToken:regToken,
              isAppBusy:false,
              currentlyConnectedPatrol:"null",
              patrolRequests:{
                incoming:{
                  pending:"null",
                  rejected:"null",
                  approved:"null"
                },
                outgoing:{
                  pending:"null",
                  rejected:"null",
                  approved:"null"
                }
              }
            },
            bleScanner:{
              scannerConfig:{
                isScannerBusy:false,
                scanTime:"null"
              },
              scannedDevices:"null"
            },
            bleDfu:{
              currentTask:"null",
              pendingTask:"null",
              completedTask:"null",
              failedTask:"null",
              isDfuModeEnabled:false
            }
          }
        })
        .then(()=>{
          console.log("Scout Updated");
        })
      }
      else{
        console.log("Scout Already Present");
      }
    })
  })

}

var newExpert = function(UID,regToken)
{
    var ref = db.ref("/");
    var PatRef = ref.child("Patrol");

    return new Promises(function(resolve,reject){
      PatRef.child(UID).once('value',function(snapshot){
        var patRecordPresent = (snapshot.val()!==null);
        resolve(patRecordPresent);
      })
    }).then(function(patRecordPresentBool){
      if(!patRecordPresentBool)
      {
        PatRef.update({
          [UID]:{
            regToken:regToken,
            currentlyConnectedScouts : "null",
            scoutRequests:{
              incoming:{
                pending:"null",
                rejected:"null",
                approved:"null"
              },
              outgoing:{
                pending:"null",
                rejected:"null",
                approved:"null"
              }
            }
          }
        })
        .then(function(){
          console.log("Patrol Updated");
        })
      }
      else {
        console.log("Patrol Already Present");
      }
    })

}

var verifyAndGetUIDDummy = function(){
  return new Promises(function(resolve,reject){
    resolve("KaZnhyEsjcaoaVYKETA2oczEOgP2");
  })
}


//post route to get email and set up Patrol record
app.get("/expertSignup",function(req,res){

  verifyAndGetUID(req.body.IDToken).then(function(UID){
    if(UID != null)
    {
      console.log("Expert UID Verified\nUpdating Patrol for UID : "+UID)
      return newExpert(UID,req.body.regToken);
    }
    else
    {
      console.log("Unauthenticated");
    }
  })
  .then(function(){
    res.send("Expert Signup Request Handled");
  })

})

//post route to get email and set up Scout record
app.get("/clientSignup",function(req,res){

  verifyAndGetUID(req.body.IDToken).then(function(UID){
    if(UID != null)
    {
      console.log("Client UID Verified\nUpdating Scout for UID : "+UID)
      return newClient(UID,req.body.regToken);
    }
    else
    {
      console.log("Unauthenticated");
    }
  })
  .then(function(){
    res.send("Client Signup Request Handled");
  })
})

//request for initial Connection
app.get("/initialConnect",function(req,res){

})

//post request by expert to connect to a scout
app.get("/requestByExpert",function(req,res){
  var result = "";
  verifyAndGetUID(req.body.IDToken).then(function(eUID){ //expert's UID is returned after decoding the ID token
    if(eUID != null)
    {
      return getRecordByEmail(req.body.clientEmailID).then(function(cUID){
        if(cUID != null)
        {
          var scoutRef = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/incoming/pending");
          var scoutRefChild = scoutRef.child(eUID);

          var patRef = db.ref("Patrol/"+eUID+"/scoutRequests/outgoing/pending");
          var patRefChild = patRef.child(cUID)

          getRecordByUID(eUID).then(function(emailFrom)
          {
          scoutRefChild.push({
            "receivedFrom":emailFrom,
            "receivedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
          })
          .then(function()
          {
            getRecordByUID(cUID).then(function(emailTo){
              patRefChild.push({
                "sentTo":emailTo,
                "sentAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
              })
            })
          })
          .then(function(){
            result = "Successful";
            console.log("Expert Request : Request Updated into Patrol's and Scout's Pending Node");
          })

        })

        }
        else
        {
          console.log("Client UID not Found");
          result = "Unsuccessful";
        }
      })
    }
    else
    {
      console.log("Expert UID not found");
      result = "Unsuccessful";
    }
  })
  .then(function(){
    var resultVal = setInterval(function(){
      if(result != "")
      {
        res.send("Request by Expert Complete : "+result);
        result="";
        clearInterval(resultVal);
      }
    },100)
  })
})

app.get("/requestByClient",function(req,res){
  var result = "";
  verifyAndGetUID(req.body.IDToken).then(function(cUID){ //client's UID is returned after decoding the ID token
    if(cUID != null)
    {
      return getRecordByEmail(req.body.expertEmailID).then(function(eUID){
        if(eUID != null)
        {
          //eUID = "expertKaZnhyEsjcaoaVYKETA2oczEOgP2";
          var scoutRef = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/outgoing/pending");
          var scoutRefChild = scoutRef.child(eUID);

          var patRef = db.ref("Patrol/"+eUID+"/scoutRequests/incoming/pending");
          var patRefChild = patRef.child(cUID)

          getRecordByUID(eUID).then(function(sentTo){
            scoutRefChild.push({
              "sentTo":sentTo,
              "sentAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
            })
            .then(function()
            {
              getRecordByUID(cUID).then(function(receivedFrom){
                patRefChild.push({
                  "receivedFrom":receivedFrom,
                  "receivedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
                })
              })
            })
            .then(function(){
              result = "Successful";
              console.log("Client Request : Request Updated into Patrol's and Scout's Pending Node");
            })
          })
        }
        else
        {
          console.log("Expert's UID not Found");
          result = "Unsuccessful";
        }
      })
    }
    else
    {
      console.log("Client's UID not found");
      result = "Unsuccessful";
    }
  })
  .then(function(){
    var resultVal = setInterval(function(){
      if(result != "")
      {
        res.send("Request by Client Complete : "+result);
        result="";
        clearInterval(resultVal);
      }
    },100)
  })
})

app.listen(8083);
