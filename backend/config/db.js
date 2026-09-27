import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri === 'YOUR_MONGODB_ATLAS_CONNECTION_STRING') {
    console.error(
      '❌  MONGODB_URI is not set. Please add your Atlas connection string to backend/.env'
    );
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅  MongoDB connected successfully → ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
