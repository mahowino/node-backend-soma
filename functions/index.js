/* eslint-disable indent */
/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");


admin.initializeApp(functions.config.firestore);
const db = admin.firestore();

// mpesa callback code
exports.callbackUrl = functions.https.onRequest(async (request, response) => {
  console.log("Callback received.");
  const uid = request.query.userid;
  console.log("the usid is " + uid);

  let date = undefined;
  let amount = undefined;
  let receipt = undefined;
  let number = undefined;

  const callbackData = request.body.Body.stkCallback;

  if (callbackData.ResultCode === 0) {
  // set the transaction details to the database users/userId/mpesaTransactions

    callbackData.CallbackMetadata.Item.forEach((element) => {
      switch (element.Name) {
        case "Amount":
          amount = element.Value;
          console.log("amount is" + element.Value);
          break;
        case "MpesaReceiptNumber":
          receipt = element.Value;
          console.log("receipt is" + element.Value);
          break;
        case "TransactionDate":
          date = element.Value;
          console.log("date is" + element.Value);
          break;
        case "PhoneNumber":
          number = element.Value;
          console.log("number is" + element.Value);
          break;
      }
    });

    // get data first on amount in database.
    // update mpesa transactions.

    const data = {
      receiptMpesa: receipt,
      phoneNumber: number,
      TransactionDate: date,
      cash: amount,
      ResultCode: request.body.Body.stkCallback.ResultCode,
    };
updateWallet(uid, amount);
}
},
);

 // eslint-disable-next-line require-jsdoc
 async function updateWallet(uid, amount) {
   // get walllet data
    // eslint-disable-next-line no-unused-vars, camelcase
    const wallet_data_ref=db.collection("user").doc(uid);
    const doc = await wallet_data_ref.get();
    if (doc.empty) {
      return;
    }
    const creditsInWallet=parseFloat(doc.get("credits"));
    const newCredit=creditsInWallet+amount;
    const credits={
        credits: newCredit,
    };

    wallet_data_ref.update(credits);
}

exports.scheduledFunction = functions.pubsub.schedule("0 0 * * *").onRun(async (context) => {
  const docRef= await db.collection("payments").get();
  if (docRef.empty) {
    return;
  }
  docRef.forEach(async (doc) => {
 if (doc.get("date")<new Date() && doc.get("is_payment_disputed")===false) {
      // transact payment
      const receiverId=doc.get("receiver_id");
      const credits=doc.get("credits");
      const senderId=doc.get("sender_id");
      updateWallet(receiverId, credits);

      const data={
        reciever: receiverId,
        credits: credits,
        senderId: senderId,
        course_name: doc.get("course_name"),
        course_credits: doc.get("course_credits"),
        course_description: doc.get("course_description"),
        course_schedule: doc.get("course_schedule"),
        course_image_url: doc.get("course_image_url"),
        course_payment_status: doc.get("course_payment_status"),
        course_tutor: doc.get("course_tutor"),
        course_zoom_link: doc.get("course_zoom_link"),
      };

       // put to history collection
      db.collection("user").doc(senderId).collection("completed_courses").doc().create(data);
      db.collection("user").doc(receiverId).collection("completed_courses").doc().create(data);
      // delete payment.
      await db.collection("payments").doc(doc.id).delete();
      await db.collection("offered_courses").doc(doc.id).delete();
    }
});
});
