import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWtnzZ2zwSgJJMGNlqmf_ThlTt3Coq7is",
  authDomain: "skillswap-4c5ee.firebaseapp.com",
  projectId: "skillswap-4c5ee",
  storageBucket: "skillswap-4c5ee.firebasestorage.app",
  messagingSenderId: "877730739852",
  appId: "1:877730739852:web:c850cac003041fa76a6da9",
  measurementId: "G-JJ3SF4T6KX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Storage
export const storage = getStorage(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add additional scopes for Google OAuth
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");

// Set custom parameters for better UX
googleProvider.setCustomParameters({
  prompt: "select_account" // Force account selection each time
});
