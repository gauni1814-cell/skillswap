const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Message = require("./models/Message");

// =====================
// Routes
// =====================
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const matchRoutes = require("./routes/matchRoutes");
const aiMatchRoutes = require("./routes/aiMatchRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

// =====================
// App & Server
// =====================
const app = express();
const server = http.createServer(app);

// =====================
// Middlewares
// =====================
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
// Increase payload limit for profile photo uploads (10MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security headers for COOP policy (fixes popup issues)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// =====================
// API Routes
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/ai", aiMatchRoutes);
app.use("/api/session", sessionRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("SkillSwap API & Socket Running 🚀");
});

// =====================
// MongoDB Connection Helper
// =====================
const isDbConnected = () => {
  const state = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  return state === 1;
};

// =====================
// MongoDB Connection
// =====================
const connectDB = () => {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
      console.log("❌ MongoDB Connection Error:", err.message);
    });
};

// Connect to MongoDB
connectDB();

// Track online users: Map<userId, socketId>
const onlineUsers = new Map();

// =====================
// Socket.IO Setup
// =====================
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // Handle user coming online
  socket.on("user_online", async (userId) => {
    if (!userId) return;
    
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    
    // Check if database is connected before attempting update
    if (!isDbConnected()) {
      console.warn("⚠️ MongoDB not connected - skipping user online status update");
      // Still broadcast status to clients for UI purposes
      io.emit("user_status_change", { userId, isOnline: true });
      console.log(`✅ User ${userId} is now online (DB unavailable)`);
      return;
    }
    
    // Update database only if connected
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
    } catch (err) {
      console.error("Error updating user online status:", err.message);
    }
    
    // Broadcast to all clients
    io.emit("user_status_change", { userId, isOnline: true });
    console.log(`✅ User ${userId} is now online`);
  });

  // Handle user going offline
  socket.on("user_offline", async (userId) => {
    if (!userId) return;
    
    onlineUsers.delete(userId);
    
    // Check if database is connected before attempting update
    if (!isDbConnected()) {
      console.warn("⚠️ MongoDB not connected - skipping user offline status update");
      io.emit("user_status_change", { userId, isOnline: false });
      console.log(`❌ User ${userId} is now offline (DB unavailable)`);
      return;
    }
    
    try {
      await User.findByIdAndUpdate(userId, { isOnline: false });
    } catch (err) {
      console.error("Error updating user offline status:", err.message);
    }
    
    io.emit("user_status_change", { userId, isOnline: false });
    console.log(`❌ User ${userId} is now offline`);
  });

  // Join a specific chat room for private messaging
  socket.on("join_chat", ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;
    
    const roomId = [senderId, receiverId].sort().join("_");
    socket.join(roomId);
    console.log(`📥 User ${senderId} joined chat room: ${roomId}`);
  });

  // Send private message
  socket.on("send_message", async (data) => {
    // Check if database is connected
    if (!isDbConnected()) {
      console.warn("⚠️ MongoDB not connected - cannot send message");
      return;
    }
    
    try {
      const { senderId, receiverId, message, chatId } = data;
      
      if (!message || !senderId || !receiverId) {
        console.log("⚠️ Missing required fields for message");
        return;
      }

      // Create message in database
      const newMessage = await Message.create({
        sender: senderId,
        receiver: receiverId,
        text: message,
        chatId: chatId || [senderId, receiverId].sort().join("_")
      });

      // Populate sender info
      await newMessage.populate("sender", "name photo");

      // Get the room ID
      const roomId = [senderId, receiverId].sort().join("_");
      
      // Emit to the specific chat room
      io.to(roomId).emit("receive_message", {
        _id: newMessage._id,
        sender: newMessage.sender,
        receiver: { _id: receiverId },
        text: newMessage.text,
        createdAt: newMessage.createdAt
      });

      console.log(`💬 Message sent from ${senderId} to ${receiverId}`);
    } catch (err) {
      console.error("❌ Error sending message:", err.message);
    }
  });

  // Handle typing indicator
  socket.on("typing", ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;
    const roomId = [senderId, receiverId].sort().join("_");
    socket.to(roomId).emit("user_typing", { senderId, isTyping: true });
  });

  // Handle stop typing
  socket.on("stop_typing", ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;
    const roomId = [senderId, receiverId].sort().join("_");
    socket.to(roomId).emit("user_typing", { senderId, isTyping: false });
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    console.log("🔴 Client disconnected:", socket.id);
    
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      
      // Check if database is connected before attempting update
      if (!isDbConnected()) {
        console.warn("⚠️ MongoDB not connected - skipping user offline status update on disconnect");
        io.emit("user_status_change", { userId: socket.userId, isOnline: false });
        console.log(`🔴 User ${socket.userId} disconnected (DB unavailable)`);
        return;
      }
      
      try {
        await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      } catch (err) {
        console.error("Error updating user offline status:", err.message);
      }
      
      io.emit("user_status_change", { userId: socket.userId, isOnline: false });
      console.log(`🔴 User ${socket.userId} disconnected`);
    }
  });
});

// =====================
// MongoDB Connection Event Listeners
// =====================
mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.log("❌ MongoDB error:", err.message);
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 MongoDB reconnected");
});

// =====================
// Server Start
// =====================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server & Socket running on port ${PORT}`);
});
