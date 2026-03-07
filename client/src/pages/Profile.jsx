import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState(null);
  const [newSkill, setNewSkill] = useState("");
  const [skillType, setSkillType] = useState("teach");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
    title: ""
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch("/api/users/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const data = await response.json();
      setUser(data);
      setFormData({
        name: data.name || "",
        email: data.email || "",
        bio: data.bio || "",
        title: data.title || ""
      });
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Failed to load profile");
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("token");
    setIsSaving(true);

    try {
      const response = await fetch("/api/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const data = await response.json();
      setUser(data.user);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile");
    }
    setIsSaving(false);
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim()) return;

    const token = localStorage.getItem("token");
    const currentSkills = user.skills || [];
    
    const updatedSkills = [...currentSkills, { 
      name: newSkill.trim(), 
      type: skillType,
      level: "Intermediate"
    }];

    try {
      const response = await fetch("/api/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ skills: updatedSkills })
      });

      if (!response.ok) {
        throw new Error("Failed to add skill");
      }

      const data = await response.json();
      setUser(data.user);
      setNewSkill("");
    } catch (err) {
      console.error("Error adding skill:", err);
      setError("Failed to add skill");
    }
  };

  const handleRemoveSkill = async (index) => {
    const token = localStorage.getItem("token");
    const currentSkills = user.skills || [];
    const updatedSkills = currentSkills.filter((_, i) => i !== index);

    try {
      const response = await fetch("/api/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ skills: updatedSkills })
      });

      if (!response.ok) {
        throw new Error("Failed to remove skill");
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      console.error("Error removing skill:", err);
      setError("Failed to remove skill");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be less than 3MB");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;

        // Update user photo in database
        const response = await fetch("/api/users/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ photo: base64Image })
        });

        if (!response.ok) {
          throw new Error("Failed to update profile photo");
        }

        const data = await response.json();
        setUser(data.user);
        setIsUploading(false);
      };

      reader.onerror = () => {
        setError("Failed to read image file");
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError("Failed to upload photo. Please try again.");
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pt-24 pb-12 max-w-7xl mx-auto px-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-24 pb-12 max-w-7xl mx-auto px-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchUserData}
            className="mt-4 text-primary hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const skillsOffered = user?.skills?.filter(s => s.type === "teach") || [];
  const skillsWanted = user?.skills?.filter(s => s.type === "learn") || [];

  return (
    <div className="pt-24 pb-12 max-w-7xl mx-auto px-6">
      <div className="bg-white rounded-3xl shadow-lg shadow-primary/5 p-8 mb-8 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-full blur-3xl"></div>
        
        <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="relative group">
            {user?.photo ? (
              <img
                src={user.photo}
                className="h-40 w-40 rounded-3xl object-cover border-4 border-white shadow-lg"
                alt="user"
              />
            ) : (
              <div className="h-40 w-40 rounded-3xl border-4 border-white shadow-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-5xl font-bold">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            {/* Upload Button Overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 bg-black/50 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {isUploading ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="text-white text-center">
                  <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs font-medium">Change Photo</span>
                </div>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
              disabled={isUploading}
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Frontend Developer"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-gray-900">
                    {user?.name || "User"}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Online
                  </span>
                </div>
                
                <p className="text-gray-500 font-medium mb-2">
                  {user?.title || "Skill Enthusiast"}
                </p>
                
                <p className="text-gray-600 max-w-xl mb-4">
                  {user?.bio || "Looking to exchange skills and grow together."}
                </p>
              </>
            )}

            <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-6">
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-primary">{skillsOffered.length}</div>
                <div className="text-sm text-gray-500">Teaching</div>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-secondary">{skillsWanted.length}</div>
                <div className="text-sm text-gray-500">Learning</div>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-purple-600">{user?.trustScore || 0}</div>
                <div className="text-sm text-gray-500"> Trust Score</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <button 
                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(!isEditing)}
                disabled={isSaving}
                className="bg-gradient-to-r from-primary to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 disabled:opacity-70"
              >
                {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Edit Profile"}
              </button>

              {isEditing && (
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user?.name || "",
                      email: user?.email || "",
                      bio: user?.bio || "",
                      title: user?.title || ""
                    });
                  }}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all duration-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl shadow-lg shadow-primary/5 p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            Skills I Can Teach
          </h3>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={skillType === "teach" ? newSkill : ""}
              onChange={(e) => {
                setSkillType("teach");
                setNewSkill(e.target.value);
              }}
              placeholder="Add a skill to teach..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            />
            <button
              onClick={handleAddSkill}
              disabled={!newSkill.trim()}
              className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {skillsOffered.length > 0 ? (
              skillsOffered.map((skill, i) => (
                <span
                  key={i}
                  className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-indigo-50 text-primary px-4 py-2 rounded-full text-sm font-medium border border-primary/20"
                >
                  {skill.name}
                  <button 
                    onClick={() => handleRemoveSkill(i)}
                    className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No skills added yet. Add skills you can teach!</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg shadow-secondary/5 p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <span className="w-2 h-8 bg-secondary rounded-full"></span>
            Skills I Want to Learn
          </h3>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={skillType === "learn" ? newSkill : ""}
              onChange={(e) => {
                setSkillType("learn");
                setNewSkill(e.target.value);
              }}
              placeholder="Add a skill to learn..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none text-sm"
            />
            <button
              onClick={handleAddSkill}
              disabled={!newSkill.trim()}
              className="bg-secondary text-white px-4 py-2 rounded-xl hover:bg-secondary/90 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {skillsWanted.length > 0 ? (
              skillsWanted.map((skill, i) => {
                const originalIndex = user?.skills?.findIndex(s => s.name === skill.name && s.type === "learn") || 0;
                return (
                  <span
                    key={i}
                    className="group inline-flex items-center gap-2 bg-gradient-to-r from-secondary/10 to-emerald-50 text-secondary px-4 py-2 rounded-full text-sm font-medium border border-secondary/20"
                  >
                    {skill.name}
                    <button 
                      onClick={() => handleRemoveSkill(originalIndex)}
                      className="w-5 h-5 rounded-full bg-secondary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary/20"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm">No skills added yet. Add skills you want to learn!</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleLogout}
          className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

