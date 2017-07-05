var Promises = require("bluebird");
var admin = require("firebase-admin");
var express = require("express");
var cors = require("cors");
var app = express();
var bodyParser = require('body-parser')
var serviceAccount = require("./wispero-172517.json");

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
//app.use(express.json());       // to support JSON-encoded bodies
//app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(cors());

admin.initializeApp({                                       //initializing the admin SDK to connect to firebase
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://wispero-172517.firebaseio.com"
});

var db = admin.database();                                  //db contains the database reference
var ref = db.ref("/");                                      //to get the reference of the root of the database

//to get snapshot of the database

/*ref.once("value", function(snapshot) {
  console.log(snapshot.val());
});*/

//var uid = "KaZnhyEsjcaoaVYKETA2oczEOgP2";
//get user records by the UID obtained after decoding the ID token received via the request from the client( Expert Device)

app.post("/check",function(req,res){                         //check route for testing post request
  console.log(req.body);
  console.log("another\n"+req.body.name)
  res.send("hello!"+req.body.name);
})

// ======================================================================================================================================================================
var getRecordByUID = function(uid){                          //Getting the email by UID
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

var getRecordByEmail = function(email){                      //getting the UID by the email ID
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

var verifyAndGetUID = function(IDtoken){                     //IDToken for verification of the user's presence and returning the UID
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

var newClient = function(UID,regToken){                      //UID of the client,regToken of the current device
    var ref = db.ref("/");
    var ScoRef = ref.child("Scout");

    return new Promises(function(resolve,reject){
      ScoRef.child(UID).once('value',function(snapshot){
        var userRecordPresent = (snapshot.val()!==null);
        resolve(userRecordPresent);
      })
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
              },
              scanRequests:{
                incoming:{
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
}

var checkIfChildPresent = function(childToCheck){  //(db reference, node under which the childToCheck is present,childToCheck for presence)
  return new Promises(function(resolve,reject){
    db.ref(childToCheck).once('value',function(snapshot){
      var recordPresent = (snapshot.val() !== null);
      resolve(recordPresent);
    })
  })
}

var removeChild = function(childToRemove){                      //(db reference,reference to the child to be removed)
  return new Promises(function(resolve,reject){
    db.ref(childToRemove).remove().then(function(result){
      console.log(REF+" : Removed");
      resolve("Successfully Removed");
    })
  })

}

var newExpert = function(UID,regToken){                      //UID of the expert,regToken of the current device
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
            },
            scanRequests:{
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

var verifyAndGetUIDDummy = function(yelo){                   //dummy function for testing purpose, insert the UID in the resolve to use this function
  return new Promises(function(resolve,reject){
    resolve("VEKf5sagVWP1kcEbaykT12Tii2x1");
  })
}
//========================================================================================================================================================================

//========================================================================================================================================================================
//post route to post email and set up Patrol record
app.post("/expertSignup",function(req,res){

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
app.post("/clientSignup",function(req,res){

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

//request for disconnection by Client
app.post("/disconnectionRequestByClient",function(req,res){
  verifyAndGetUID().then((cUID)=>{
    if(req.body.expertEmail != null)  //req.body.expertEmail
    {
      getRecordByEmail(req.body.expertEmail).then((eUID)=>{   //req.body.expertEmail
        var patRef = "/Patrol/"+eUID+"/currentlyConnectedScouts/"+cUID;
        var scoutRef = "/Scout/"+cUID+"/appConfig/currentlyConnectedPatrol/"+eUID;

        checkIfChildPresent(scoutRef).then((patrolPresentBool)=>{
          if(patrolPresentBool)
          {
            removeChild(scoutRef).then((result)=>{
              console.log("#Result After Removal of currentlyConnectedPatrol Node : "+result);
              removeChild(patRef).then((result)=>{
                console.log("#Result After Removal of currentlyConnectedScouts Node : "+result);
              })
            })
          }
          else {
            console.log(eUID+" : Patrol Not Connected to Scout");
          }
        })
      })
    }
    else {
      console.log("Expert Email ID not Received");
    }
  }).then(()=>{
    console.log("Disconnection Request Processed");
    res.send("Disconnection Request Processed, Check console for Results");
  })
})

//request for disconnection by Expert , updates the currentlyConnectedNodes by deleted the required UIDs
app.post("/disconnectionRequestByExpert",function(req,res){
  verifyAndGetUID().then((eUID)=>{
    if(req.body.clientEmail !== null) //req.body.clientEmail
    {
      getRecordByEmail(req.body.clientEmail).then((cUID)=>{ //req.body.clientEmail
        var patRef = "/Patrol/"+eUID+"/currentlyConnectedScouts/"+cUID;
        var scoutRef = "/Scout/"+cUID+"/appConfig/currentlyConnectedPatrol/"+eUID;

        checkIfChildPresent(patRef).then((scoutPresentBool)=>{
          if(scoutPresentBool)
          {
            removeChild(patRef).then((result)=>{
              console.log("Result After Removal of currentlyConnectedScouts Node : "+result);
              removeChild(scoutRef).then((result)=>{
                console.log("Result After Removal of currentlyConnectedPatrol Node : "+result);
              })
            });
          }
          else {
            console.log(cUID+" : Scout Not Connected to Patrol")
          }
        })
      })
    }
    else {
      console.log("Client Email ID not Received");
    }
  }).then(()=>{
    console.log("Disconnection Request Processed");
    res.send("Disconnection Request Processed, Check console for Results");
  })
})

//initial Connection Approval by Client, updates the currentlyConnectedNodes of Client and Expert
app.post("/initialConnectionApprovalByClient",function(req,res){
  verifyAndGetUID(req.body.IDToken).then(function(cUID){
    if(cUID)
    {
        console.log("Client ID Token Verified");
      getRecordByEmail(req.body.expertEmail).then(function(eUID){
        console.log("Expert UID Retrieved");

        var patRef = db.ref("Patrol/"+eUID);
        var patRefChild = patRef.child("currentlyConnectedScouts");

        var scoutRef = db.ref("Scout/"+cUID+"/appConfig");
        var scoutRefChild = scoutRef.child("currentlyConnectedPatrol")


        var scoutRefApproved = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/incoming/approved");
        var scoutRefChildApproved = scoutRefApproved.child(eUID);

        var patRefApproved = db.ref("Patrol/"+eUID+"/scoutRequests/outgoing/approved");
        var patRefChildApproved = patRefApproved.child(cUID)


        var scoutRefPending = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/incoming/pending");
        var scoutRefChildPending = scoutRefPending.child(eUID);

        var patRefPending = db.ref("Patrol/"+eUID+"/scoutRequests/outgoing/pending");
        var patRefChildPending = patRefPending.child(cUID);


        getRecordByUID(cUID).then(function(clientEmailID){
          //updating the currentlyConnectedNodes of Scout and Patrol
          patRefChild.update({
            [cUID]:clientEmailID
          })
          console.log("currentlyConnectedScouts Updated");
        }).then(function(){
          scoutRefChild.update({
            [eUID]:req.body.expertEmail
          })
          console.log("currentlyConnectedPatrol Updated");
        }).then(function(){
          //Updating the approved nodes of Scout and Patrol
          scoutRefChildApproved.update({
            "typeOfRequest":"Initial Connection",
            "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
          }).then(function(){
            patRefChildApproved.update({
              "typeOfRequest":"Initial Connection",
              "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
            })
          })
          //to move the request from pending nodes to approved nodes
        }).then(function(){
          //Removing the pending nodes of Scout and Patrol
          scoutRefChildPending.remove().then(function(){
            console.log("Scout Pending Node Removed");
          })
          patRefChildPending.remove().then(function(){
            console.log("Patrol Pending Node Removed")
          })
        })
      })
    }
    else {
      console.log("Client UID Not Found");
    }
  }).then(function(){
    res.send("Request Processed");
  })
})

//initial connection approval by expert, updates the currentlyConnectedNodes of Expert and Client
app.post("/initialConnectionApprovalByExpert",function(req,res){
  verifyAndGetUID(req.body.IDToken).then(function(eUID){ //req.body.IDToken of expert
    if(eUID)
    {
      console.log("Expert ID Token Verified");
      getRecordByEmail(req.body.clientEmail).then(function(cUID){ //req.body.clientEmail
        console.log("Client UID Retrieved");

        var patRef = db.ref("Patrol/"+eUID);
        var patRefChild = patRef.child("currentlyConnectedScouts");

        var scoutRef = db.ref("Scout/"+cUID+"/appConfig");
        var scoutRefChild = scoutRef.child("currentlyConnectedPatrol")


        var scoutRefApproved = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/outgoing/approved");
        var scoutRefChildApproved = scoutRefApproved.child(eUID);

        var patRefApproved = db.ref("Patrol/"+eUID+"/scoutRequests/incoming/approved");
        var patRefChildApproved = patRefApproved.child(cUID)


        var scoutRefPending = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/outgoing/pending");
        var scoutRefChildPending = scoutRefPending.child(eUID);

        var patRefPending = db.ref("Patrol/"+eUID+"/scoutRequests/incoming/pending");
        var patRefChildPending = patRefPending.child(cUID)


        getRecordByUID(eUID).then(function(expertEmailID){
          //updating the currentlyConnectedNodes of Scout and Patrol
          scoutRefChild.update({
            [eUID]:expertEmailID
          }).then(function(){
            console.log("currentlyConnectedPatrol Updated");
          })
        }).then(function(){
          patRefChild.update({
            [cUID]:req.body.clientEmail //req.body.clientEmail
          }).then(function(){
            console.log("currentlyConnectedScouts Updated");
          })
        }).then(function(){
          //updating the Approved Nodes of Scout and Patrol
          scoutRefChildApproved.update({
            "typeOfRequest":"Initial Connection",
            "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
          }).then(function(){
            patRefChildApproved.update({
              "typeOfRequest":"Initial Connection",
              "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
            })
            console.log("Approved Nodes Updated for Scout and Patrol")
          })
        }).then(function(){
          //Removing the Pending child nodes of Scout and Patrol
          scoutRefChildPending.remove().then(function(){
            console.log("Scout Pending Node Child Removed");
          })
          patRefChildPending.remove().then(function(){
            console.log("Patrol Pending Node Child Removed")
          })
        })
      })
    }
    else {
      console.log("Expert UID Not Found");
    }
  }).then(function(){
    res.send("Request Processed");
  })
})

//post request by expert to connect to a scout
app.post("/initialRequestByExpert",function(req,res){
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
          var patRefChild = patRef.child(cUID);

          getRecordByUID(eUID).then(function(emailFrom)
          {
          scoutRefChild.update({
            "receivedFrom":emailFrom,
            "typeOfRequest":"Initial Connection",
            "receivedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
          })
          .then(function()
          {
            getRecordByUID(cUID).then(function(emailTo){
              patRefChild.update({
                "sentTo":emailTo,
                "typeOfRequest":"Initial Connection",
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

//post request by client to connect to a patrol
app.post("/initialRequestByClient",function(req,res){
  var result = "";
  verifyAndGetUID(req.body.IDToken).then(function(cUID){ //client's UID is returned after decoding the ID token // req.body.IDToken
    if(cUID != null)
    {
      return getRecordByEmail(req.body.expertEmailID).then(function(eUID){  //req.body.expertEmailID
        if(eUID != null)
        {
          //eUID = "expertKaZnhyEsjcaoaVYKETA2oczEOgP2";
          var scoutRef = db.ref("Scout/"+cUID+"/appConfig/patrolRequests/outgoing/pending");
          var scoutRefChild = scoutRef.child(eUID);

          var patRef = db.ref("Patrol/"+eUID+"/scoutRequests/incoming/pending");
          var patRefChild = patRef.child(cUID)

          getRecordByUID(eUID).then(function(sentTo){
            scoutRefChild.update({
              "sentTo":sentTo,
              "typeOfRequest":"Initial Connection",
              "sentAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
            })
            .then(function()
            {
              getRecordByUID(cUID).then(function(receivedFrom){
                patRefChild.update({
                  "receivedFrom":receivedFrom,
                  "typeOfRequest":"Initial Connection",
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

//post request by expert for scanning using client's device
app.post("/scanRequestByExpert",function(req,res){
  verifyAndGetUID(req.body.IDToken).then((eUID)=>{
    getUserByEmail(req.body.clientEmail).then((cUID)=>{
      var patRef = db.ref("Patrol/"+eUID+"/scanRequests/outgoing/pending/");
      var scoutRef = db.ref("Scout/"+cUID+"/appConfig/scanRequests/incoming/pending/")

      patRef.child(cUID).update({
        "sentTo":req.body.clientEmail,
        "typeOfRequest":"Scan Request",
        "sentAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
      })

      getRecordByUID(eUID).then((expertEmail)=>{
        scoutRef.child(eUID).update({
          "receivedFrom":expertEmail,
          "typeOfRequest":"Scan Request",
          "receivedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
        })
      })
    }).then(()=>{
      console.log("Scan Request Sent to Client");
      res.send("Scan Request Sent to Client");
    })
  })
})

//scan request approval by the Client
//1.remove the pending nodes
//2.update in the approved nodes
app.post("/scanApprovalByClient",function(req,res){
  verifyAndGetUID(req.body.IDToken).then((cUID)=>{
    getUserByEmail(req.body.expertEmail).then((eUID)=>{
      var patRefPending = "Patrol/"+eUID+"/scanRequests/outgoing/pending/"+cUID;
      var scoutRefPending = "Scout/"+cUID+"/appConfig/scanRequests/incoming/pending/"+eUID;

      var patRefApproved = "Patrol/"+eUID+"/scanRequests/outgoing/approved/"+cUID;
      var scoutRefApproved = "Scout/"+cUID+"/appConfig/scanRequests/incoming/approved/"+eUID;

      checkIfChildPresent(patRefPending).then((result)=>{
        if(result)
        {
          removeChild(patRefPending).then(()=>{
            console.log(cUID+" : Pending Request Node Removed from Patrol");
            checkIfChildPresent(scoutRefPending).then((result)=>{
              if(result)
              {
                removeChild(scoutRefPending).then(()=>{
                  console.log(eUID+" : Pending Request Node Removed from Scout");
                })
              }
              else {
                console.log(eUID+" : Pending Request Node Not Present in Scout");
              }
            })
          }).then(()=>{
            scoutRefApproved.push({
              "receivedFrom":req.body.expertEmail,
              "typeOfRequest":"Scan Request",
              "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
            })
            console.log("Request Approved Node Added in Scout Approved");
          }).then(()=>{
            getRecordByUID(cUID).then((clientEmail)=>{
              patRefApproved.push({
                "sentTo":clientEmail,
                "typeOfRequest":"Scan Request",
                "approvedAt":new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
              })
              console.log("Request Approved Node Added in Patrol Approved");
            })
          })
        }
        else {
          console.log(cUID+" : Pending Request Node Not Present in Patrol");
        }
      })
    })
  })
})

//========================================================================================================================================================================
app.listen(8080);
