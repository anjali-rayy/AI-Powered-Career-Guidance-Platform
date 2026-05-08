# 🤖 AI-Powered Career Guidance & Job Matching Platform

> An intelligent platform that helps users discover career paths, get personalized guidance, and find matching job opportunities using AI.

---

## 📌 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [License](#license)

---

## 📖 About the Project

The **AI-Powered Career Guidance & Job Matching Platform** is a web-based application designed to help students, freshers, and professionals navigate their career journey. By leveraging AI, the platform provides personalized career recommendations, skill gap analysis, and intelligent job matching — all in one place.

Whether you're just starting out or looking to switch careers, this platform acts as your personal AI career advisor.

---

## ✨ Features

- 🎯 **AI Career Guidance** — Get personalized career path recommendations based on your skills and interests
- 🔍 **Smart Job Matching** — Find jobs that align with your profile and goals
- 👤 **User Authentication** — Secure signup/login with JWT-based authentication
- 🔐 **Password Encryption** — User passwords hashed securely using bcrypt
- 📄 **Multi-page Navigation** — Clean, responsive UI with multiple pages
- 📦 **RESTful Backend** — Node.js backend with MongoDB for data storage

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5
- CSS3
- JavaScript (Vanilla)

**Backend:**
- Node.js
- MongoDB (via Mongoose)
- JSON Web Tokens (JWT) for authentication
- bcrypt for password hashing
- node-fetch for API requests

---

## 📁 Project Structure

```
AI-Powered-Career-Guidance-And-Job-Matching-Platform/
│
├── assets/              # Images, icons, and static assets
├── backend/             # Node.js backend (API, models, routes)
├── pages/               # HTML pages for the platform
├── index.html           # Main entry point
├── package.json         # Project dependencies
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or above)
- [MongoDB](https://www.mongodb.com/) (local or Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anjali-rayy/AI-Powered-Career-Guidance-And-Job-Matching-Platform.git
   cd AI-Powered-Career-Guidance-And-Job-Matching-Platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory and add:
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=3000
   ```

4. **Start the backend server**
   ```bash
   node backend/server.js
   ```

5. **Open the app**

   Open `index.html` in your browser or serve it using a local server:
   ```bash
   npx live-server
   ```

---

## 💡 Usage

1. Register or log in to your account
2. Fill in your skills, interests, and career goals
3. Get AI-powered career path suggestions
4. Browse matched job listings tailored to your profile
5. Explore resources and guidance to upskill

---

## 📬 Contact

**Anjali Ray** — [@anjali-rayy](https://github.com/anjali-rayy)

Project Link: [https://github.com/anjali-rayy/AI-Powered-Career-Guidance-And-Job-Matching-Platform](https://github.com/anjali-rayy/AI-Powered-Career-Guidance-And-Job-Matching-Platform)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">Made with ❤️ by Anjali Ray</p>
