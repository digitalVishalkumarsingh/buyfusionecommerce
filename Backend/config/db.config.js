const mongoose = require('mongoose');

const dbConnection = async () => {
    try {
        // Connect to MongoDB using the URI from the environment variable
        await mongoose.connect(process.env.MONGO_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log("Database connected successfully!");
    } catch (error) {
        // Log any error during the database connection
        console.error("MongoDB connection error:", error);
    }
};

module.exports = dbConnection;
