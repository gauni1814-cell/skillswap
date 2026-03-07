import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import socket, { isSocketConnected, onSocketConnected } from "../socket";

// API Base URL - use empty string for relative URLs
const API_URL = "";

export default function Chat() {
  const navigate = useNavigate();
  
  // Check if user is logged in
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!token || !currentUser) {
      navigate("/login");
    }
  }, [token, currentUser, navigate]);

  // Track socket connection status
  useEffect(() => {
    setSocketConnected(isSocketConnected());
    
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  // Initialize socket listeners
  useEffect(() => {
    if (!token || !currentUser) return;

    if (socketConnected) {
      socket.emit("user_online", currentUser._id);
    } else {
      onSocketConnected(() => {
        if (currentUser) {
          socket.emit("user_online", currentUser._id);
        }
      });
    }

    const handleReceiveMessage = (data) => {
      console.log("📥 Received message in Chat:", data);
      
      setMessages(prev => {
        const exists = prev.some(msg => msg._id === data._id);
        if (exists) return prev;
        
        const senderId = data.sender?._id || data.sender;
        const receiverId = data.receiver?._id || data.receiver;
        
        return [...prev, {
          _id: data._id,
          sender: { _id: senderId, name: data.sender?.name, photo: data.sender?.photo },
          receiver: { _id: receiverId },
          text: data.text,
          createdAt: data.createdAt
        }];
      });

      if (selectedUser) {
        const senderId = data.sender?._id || data.sender;
        const receiverId = data.receiver?._id || data.receiver;
        
        const isRelevant = 
          (senderId === selectedUser._id) ||
          (receiverId === selectedUser._id);
        
        if (isRelevant) {
          setConversations(prev => {
            const otherUserId = senderId === currentUser._id 
              ? receiverId 
              : senderId;
            
            const existingConv = prev.find(c => c.user?._id === otherUserId);
            
            if (existingConv) {
              return prev.map(c => 
                c.user?._id === otherUserId 
                  ? { ...c, lastMessage: data.text, lastMessageTime: new Date() }
                  : c
              );
            }
            return prev;
          });
        }
      }
    };

    const handleUserTyping = (data) => {
      if (selectedUser && data.senderId === selectedUser._id) {
        setIsTyping(data.isTyping);
      }
    };

    const handleUserStatusChange = ({ userId, isOnline }) => {
      setAllUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, isOnline } : u
      ));
      setConversations(prev => prev.map(c => 
        c.user?._id === userId ? { ...c, user: { ...c.user, isOnline } } : c
      ));
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_status_change", handleUserStatusChange);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_status_change", handleUserStatusChange);
    };
  }, [token, currentUser, socketConnected, selectedUser]);

  // Join chat room when user is selected
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const joinChat = () => {
      socket.emit("join_chat", { 
        senderId: currentUser._id, 
        receiverId: selectedUser._id 
      });
    };

    if (socketConnected) {
      joinChat();
    } else {
      onSocketConnected(joinChat);
    }
  }, [selectedUser, currentUser, socketConnected]);

  // Fetch conversations
  useEffect(() => {
    if (!token) return;
    
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setConversations(data);
      } catch (err) {
        console.error("Error fetching conversations:", err);
      }
    };

    fetchConversations();
  }, [token]);

  // Fetch all users for new chat
  useEffect(() => {
    if (!token) return;
    
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setAllUsers(data.map(u => ({ ...u, isOnline: false })));
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  // Fetch messages when user is selected
  useEffect(() => {
    if (!token || !selectedUser) return;
    
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [token, selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const safeEmit = (event, data) => {
    if (socketConnected) {
      socket.emit(event, data);
    } else {
      onSocketConnected(() => {
        socket.emit(event, data);
      });
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    const messageText = newMessage.trim();

    try {
      const chatId = [currentUser._id, selectedUser._id].sort().join("_");
      
      safeEmit("send_message", {
        senderId: currentUser._id,
        receiverId: selectedUser._id,
        message: messageText,
        chatId: chatId
      });

      setMessages(prev => [...prev, {
        _id: Date.now(),
        sender: { _id: currentUser._id },
        text: messageText,
        createdAt: new Date()
      }]);
      
      setNewMessage("");
      
      safeEmit("stop_typing", {
        senderId: currentUser._id,
        receiverId: selectedUser._id
      });
      
      setConversations(prev => {
        const existing = prev.find(c => c.user?._id === selectedUser._id);
        if (existing) {
          return prev.map(c => 
            c.user?._id === selectedUser._id 
              ? { ...c, lastMessage: messageText, lastMessageTime: new Date() }
              : c
          );
        }
        return [{ user: selectedUser, lastMessage: messageText }, ...prev];
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (selectedUser && currentUser) {
      safeEmit("typing", {
        senderId: currentUser._id,
        receiverId: selectedUser._id
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        safeEmit("stop_typing", {
          senderId: currentUser._id,
          receiverId: selectedUser._id
        });
      }, 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setShowNewChat(false);
    setSearchTerm("");
    setIsTyping(false);
    // Clear unread count
    setUnreadCounts(prev => ({ ...prev, [user._id]: 0 }));
  };

  const filteredUsers = allUsers.filter(u => 
    u._id !== currentUser?._id &&
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !conversations.some(c => c.user?._id === u._id)
  );

  const getTimeString = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return "Yesterday";
    return d.toLocaleDateString();
  };

  const formatMessageTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Not logged in view
  if (!token || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="relative overflow-hidden bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center max-w-md border border-white/20 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl"></div>
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-6 transition-transform">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Welcome to SkillSwap</h2>
            <p className="text-white/60 mb-8">Please login to access your messages and connect with other learners</p>
            <button 
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:shadow-lg hover:shadow-purple-500/30 transition-all font-semibold hover:scale-105"
            >
              Login Now
            </button>
          </div>
        </div>
      </div>
    );
  }

return (
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Sidebar - Conversations */}
      <div className="w-96 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="font-bold text-2xl text-white">Messages</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                <div className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-xs text-white/70">{socketConnected ? 'Online' : 'Offline'}</span>
              </div>
              <button
                onClick={() => setShowNewChat(true)}
                className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200/50">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* User Profile Mini */}
        <div className="p-4 border-b border-slate-200/50 bg-slate-50/50">
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm">
            {currentUser?.photo ? (
              <img
                src={currentUser?.photo}
                alt={currentUser?.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{currentUser?.name}</p>
              <p className="text-xs text-slate-500">Your Profile</p>
            </div>
            <button 
              onClick={() => navigate("/profile")}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-slate-500 mt-4 text-sm">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium mb-1">No conversations yet</p>
              <p className="text-slate-400 text-sm mb-4">Start chatting with other learners</p>
              <button 
                onClick={() => setShowNewChat(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all text-sm font-medium"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.user?._id}
                onClick={() => selectUser(conv.user)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50/80 transition-all border-b border-slate-100/50 ${
                  selectedUser?._id === conv.user?._id ? "bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-l-purple-500" : ""
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.user?.photo || `https://i.pravatar.cc/40?u=${conv.user?._id}`}
                    alt={conv.user?.name}
                    className="w-14 h-14 rounded-2xl object-cover shadow-md"
                  />
                  {conv.user?.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-3 border-white rounded-xl"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-900 truncate">{conv.user?.name}</h4>
                    <span className="text-xs text-slate-400 flex-shrink-0 bg-slate-100 px-2 py-1 rounded-full">
                      {getTimeString(conv.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate flex items-center gap-2">
                    {conv.lastMessage?.length > 40 ? `${conv.lastMessage.substring(0, 40)}...` : conv.lastMessage}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      {conv.user?.skills?.slice(0, 2).map(s => s.name).join(", ") || "SkillSwap User"}
                    </span>
                  </div>
                </div>
                {unreadCounts[conv.user?._id] > 0 && (
                  <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{unreadCounts[conv.user?._id]}</span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t border-slate-200/50 bg-slate-50/50">
          <div className="flex gap-2">
            <button 
              onClick={() => navigate("/matches")}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm font-medium text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Matches
            </button>
            <button 
              onClick={() => navigate("/browse-skills")}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm font-medium text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse
            </button>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xl text-white">New Conversation</h3>
                </div>
                <button 
                  onClick={() => setShowNewChat(false)} 
                  className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search users by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                />
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 font-medium">No users found</p>
                    <p className="text-slate-400 text-sm">Try a different search term</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => selectUser(user)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all group"
                    >
                      <div className="relative">
                        {user.photo ? (
                          <img
                            src={user.photo}
                            alt={user.name}
                            className="w-14 h-14 rounded-2xl object-cover shadow-md group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                            {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                          </div>
                        )}
                        {user.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-3 border-white rounded-xl"></span>
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{user.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.skills?.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {skill.name}
                            </span>
                          ))}
                          {(!user.skills || user.skills.length === 0) && (
                            <span className="text-xs text-slate-400">No skills added yet</span>
                          )}
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-pink-500 transition-all">
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 shadow-sm">
              <button 
                onClick={() => setSelectedUser(null)}
                className="lg:hidden p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative">
                <img
                  src={selectedUser.photo || `https://i.pravatar.cc/40?u=${selectedUser._id}`}
                  alt={selectedUser.name}
                  className="w-14 h-14 rounded-2xl object-cover shadow-md"
                />
                {selectedUser.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-3 border-white rounded-xl"></span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-900">{selectedUser.name}</h3>
                <p className="text-sm">
                  {selectedUser.isOnline ? (
                    <span className="text-green-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Online
                    </span>
                  ) : (
                    <span className="text-slate-400">Offline</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-3 hover:bg-slate-100 rounded-xl transition-colors" title="View Profile">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                <button className="p-3 hover:bg-slate-100 rounded-xl transition-colors" title="More Options">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mb-4">
                    <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-slate-700 font-semibold text-lg mb-1">No messages yet</p>
                  <p className="text-slate-400 text-sm">Start the conversation by sending a message!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender?._id === currentUser?._id || msg.sender === currentUser?._id;
                  const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender?._id !== msg.sender?._id);
                  
                  return (
                    <div key={msg._id || msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                      <div className={`flex gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : ""}`}>
                        {!isMe && (
                          <div className="flex-shrink-0">
                            {showAvatar ? (
                              <img
                                src={selectedUser.photo || `https://i.pravatar.cc/40?u=${selectedUser._id}`}
                                alt={selectedUser.name}
                                className="w-10 h-10 rounded-xl object-cover shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-10"></div>
                            )}
                          </div>
                        )}
                        <div className={`${isMe ? "order-1" : "order-2"}`}>
                          <div className={`px-5 py-3.5 rounded-3xl shadow-sm ${
                            isMe 
                              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md" 
                              : "bg-white text-slate-900 rounded-bl-md border border-slate-200"
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <div className={`flex items-center gap-2 mt-2 ${isMe ? "justify-end" : "justify-start"}`}>
                            <p className={`text-xs text-slate-400`}>
                              {formatMessageTime(msg.createdAt)}
                            </p>
                            {isMe && (
                              <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <div className="flex gap-2 items-end">
                    <img
                      src={selectedUser.photo || `https://i.pravatar.cc/40?u=${selectedUser._id}`}
                      alt={selectedUser.name}
                      className="w-10 h-10 rounded-xl object-cover shadow-sm"
                    />
                    <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-md shadow-sm border border-slate-200">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200/50 px-6 py-4">
              <div className="flex items-center gap-3 bg-slate-100 rounded-2xl px-4 py-2.5 border border-slate-200 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                <button className="p-2.5 hover:bg-slate-200 rounded-xl transition-colors" title="Add attachments">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 px-2 py-2 bg-transparent focus:outline-none text-slate-900 placeholder-slate-400"
                />
                
                <button 
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="p-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
            <div className="text-center max-w-md px-6">
              <div className="w-28 h-28 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-6 transition-transform">
                <svg className="w-14 h-14 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-slate-800 mb-3">Welcome to Messages</h3>
              <p className="text-slate-500 mb-8 text-lg">Connect with other learners and start sharing skills</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl hover:shadow-xl hover:shadow-purple-500/30 transition-all font-semibold hover:scale-105"
                >
                  Start New Chat
                </button>
                <button
                  onClick={() => navigate("/matches")}
                  className="px-8 py-4 bg-white text-slate-700 rounded-2xl border-2 border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all font-semibold"
                >
                  View Matches
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

