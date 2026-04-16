const { Server } = require("socket.io");
const Message = require("./models/Message");
const mongoose = require("mongoose");

// Helper function to convert string to ObjectId
const toObjectId = (id) => {
  if (!id) return id;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
};

// Store online users
const onlineUsers = new Map();

let globalIo = null;

const socketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  // expose io to other modules via globalIo
  globalIo = io;

  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Handle user coming online
    socket.on("user_online", (userId) => {
      if (userId) {
        const wasAlreadyOnline = onlineUsers.has(userId);
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        
        // Store userId in socket for later reference
        socket.join(`user_${userId}`);
        
        // Only broadcast if user wasn't already online
        if (!wasAlreadyOnline) {
          io.emit("user_status_change", { userId, isOnline: true });
        }
        console.log(`✅ User ${userId} is online (Socket: ${socket.id})`);
      }
    });

    // Handle user going offline
    socket.on("user_offline", (userId) => {
      if (userId) {
        onlineUsers.delete(userId);
        socket.leave(`user_${userId}`);
        
        // Broadcast user status to all clients
        io.emit("user_status_change", { userId, isOnline: false });
        console.log(`❌ User ${userId} is offline`);
      }
    });

    // Join a specific chat room (for private messaging)
    socket.on("join_chat", ({ senderId, receiverId }) => {
      // Prefer authenticated socket.userId to avoid client-side spoofing
      const sid = socket.userId || senderId;
      if (!sid || !receiverId) {
        console.log("❌ join_chat missing participant ids");
        return;
      }
      const roomId = [sid, receiverId].sort().join("_");
      socket.join(roomId);
      console.log(`👥 User ${sid} joined chat room: ${roomId}`);
      console.log(`   Socket rooms:`, socket.rooms);
    });

    // Leave a specific chat room
    socket.on("leave_chat", ({ senderId, receiverId }) => {
      const roomId = [senderId, receiverId].sort().join("_");
      socket.leave(roomId);
      console.log(`👤 User ${senderId} left chat room: ${roomId}`);
    });

    // Send private message
    socket.on("send_message", async (data) => {
      try {
        // Use authenticated socket.userId as the sender to prevent spoofing
        const senderId = socket.userId || data.senderId;
        const { receiverId, message, chatId, clientMessageId } = data;

        console.log("📨 Message received on server:", { senderId, receiverId, message: message?.substring(0, 50), clientMessageId });

        if (!message || !senderId || !receiverId) {
          console.log("❌ Missing required fields");
          socket.emit("message_error", { error: "Missing required fields" });
          return;
        }

        if (senderId === receiverId) {
          console.log("❌ Cannot send message to yourself");
          socket.emit("message_error", { error: "Cannot send message to yourself" });
          return;
        }

        // Convert string IDs to ObjectIds using helper function
        const senderObjectId = toObjectId(senderId);
        const receiverObjectId = toObjectId(receiverId);

        // If clientMessageId provided, try to find an existing message (dedupe)
        let newMessage = null;
        if (clientMessageId) {
          try {
            newMessage = await Message.findOne({ sender: senderObjectId, receiver: receiverObjectId, clientMessageId });
          } catch (err) {
            // ignore lookup errors
            newMessage = null;
          }
        }

        if (!newMessage) {
          // Create message in database
          newMessage = await Message.create({
            sender: senderObjectId,
            receiver: receiverObjectId,
            text: message,
            chatId: chatId || [senderId, receiverId].sort().join("_"),
            clientMessageId: clientMessageId || undefined,
            isRead: false
          });
        } else {
          console.log(`🔁 Duplicate detected for clientMessageId=${clientMessageId}, reusing existing message ${newMessage._id}`);
        }

        // Populate sender and receiver info
        await newMessage.populate("sender", "name photo");
        await newMessage.populate("receiver", "name photo");

        // Get the room ID
        const roomId = [senderId, receiverId].sort().join("_");

        console.log(`✅ Message ready, emitting to room: ${roomId}`);

        // Prepare message data
        const messageData = {
          _id: newMessage._id,
          sender: {
            _id: newMessage.sender._id,
            name: newMessage.sender.name,
            photo: newMessage.sender.photo
          },
          receiver: {
            _id: newMessage.receiver._id,
            name: newMessage.receiver.name,
            photo: newMessage.receiver.photo
          },
          text: newMessage.text,
          createdAt: newMessage.createdAt,
          isRead: newMessage.isRead,
          clientMessageId: newMessage.clientMessageId
        };

        // Emit to the specific chat room (both sender and receiver)
        io.to(roomId).emit("receive_message", messageData);

        // Notify the receiver about the new message (for unread count update)
        io.to(`user_${receiverId}`).emit("message_received", {
          from: senderId,
          message: messageData
        });

        console.log(`✅ Message broadcast to room ${roomId}`);
        console.log(`✅ Unread notification sent to user ${receiverId}`);
      } catch (err) {
        console.error("❌ Error sending message:", err);
        socket.emit("message_error", { error: err.message });
      }
    });

    // Handle typing indicator
    socket.on("typing", ({ senderId, receiverId }) => {
      const sid = socket.userId || senderId;
      if (!sid || !receiverId) return;
      const roomId = [sid, receiverId].sort().join("_");
      socket.to(roomId).emit("user_typing", { senderId: sid, isTyping: true });
    });

    // Handle stop typing
    socket.on("stop_typing", ({ senderId, receiverId }) => {
      const sid = socket.userId || senderId;
      if (!sid || !receiverId) return;
      const roomId = [sid, receiverId].sort().join("_");
      socket.to(roomId).emit("user_typing", { senderId: sid, isTyping: false });
    });

    // Request unread counts from server
    socket.on("request_unread_counts", async (userId) => {
      try {
        const userObjectId = toObjectId(userId);
        const unreadCounts = await Message.aggregate([
          {
            $match: {
              receiver: userObjectId,
              isRead: false
            }
          },
          {
            $group: {
              _id: "$sender",
              count: { $sum: 1 }
            }
          }
        ]);

        const counts = {};
        unreadCounts.forEach(item => {
          counts[item._id.toString()] = item.count;
        });

        socket.emit("unread_counts_update", counts);
      } catch (err) {
        console.error("❌ Error getting unread counts:", err);
      }
    });

    // Update last message and time for conversation
    socket.on("conversation_update", ({ senderId, receiverId, lastMessage, lastMessageTime }) => {
      const roomId = [senderId, receiverId].sort().join("_");
      io.to(roomId).emit("conversation_updated", {
        lastMessage,
        lastMessageTime
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        socket.leave(`user_${socket.userId}`);
        io.emit("user_status_change", { userId: socket.userId, isOnline: false });
        console.log(`🔴 User ${socket.userId} disconnected`);
      }
      console.log("🔴 Client disconnected:", socket.id);
    });
  });

  // Make io accessible for use in controllers
  io.getIO = () => io;

  return io;
};

// Allow other modules to access the initialized io instance
socketServer.getIO = () => globalIo;

module.exports = socketServer;