const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 * Reads MONGODB_URI from environment variables.
 * Falls back to an in-memory instance for development if local/configured instance is unavailable.
 */
async function connectMongoDB() {
  let uri = process.env.MONGODB_URI;

  try {
    if (!uri) {
      uri = 'mongodb://localhost:27017/subscription-analyzer';
    }

    console.log(`📡 Connecting to MongoDB at ${uri}...`);
    
    // We set a short timeout of 3 seconds so we don't block startup too long
    // if local MongoDB is not running, enabling quick fallback.
    await mongoose.connect(uri, {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 3000,
    });

    console.log(`✅ MongoDB connected → ${mongoose.connection.host}:${mongoose.connection.port}`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed (SIGINT)');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed (SIGTERM)');
      process.exit(0);
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      console.log('⚠️ Local MongoDB connection failed. Initializing in-memory MongoDB fallback...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const os = require('os');
        const path = require('path');
        const downloadDir = path.join(os.tmpdir(), 'mongodb-binaries');
        console.log(`📂 Storing MongoDB binary in temp directory: ${downloadDir}`);
        
        const mongoServer = await MongoMemoryServer.create({
          binary: {
            version: '4.4.24', // Significantly smaller binary size for extremely fast download
            downloadDir: downloadDir
          }
        });
        const mongoUri = mongoServer.getUri();
        
        console.log(`📡 Connecting to In-Memory MongoDB at ${mongoUri}...`);
        await mongoose.connect(mongoUri, {
          autoIndex: true,
        });
        console.log(`✅ In-Memory MongoDB connected successfully!`);

        // Handle clean up of MongoMemoryServer on close
        const shutdown = async (signal) => {
          try {
            await mongoose.connection.close();
            await mongoServer.stop();
            console.log(`🔌 In-Memory MongoDB closed (${signal})`);
          } catch (stopErr) {
            console.error('Error during shutdown:', stopErr.message);
          }
          process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
      } catch (memErr) {
        console.error('❌ Failed to start In-Memory MongoDB:', memErr.message);
        process.exit(1);
      }
    } else {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    }
  }
}

module.exports = connectMongoDB;
