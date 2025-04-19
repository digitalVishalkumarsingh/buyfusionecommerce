const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://your-database.firebaseio.com"
});

// Send a push notification
const sendNotification = async (req, res) => {
  try {
    const { token, title, body } = req.body;

    const message = {
      notification: {
        title,
        body,
      },
      token: token,
    };

    await admin.messaging().send(message);
    res.status(200).json({ message: 'Notification sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending notification' });
  }
};

module.exports = { sendNotification };
