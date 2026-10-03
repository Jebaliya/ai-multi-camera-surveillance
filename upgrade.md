# Face Recognition Attendance System Upgrade Requirements

# Project Title

AI-Powered Multi-Camera Smart Surveillance + ERP Platform


# 1. Project Objective

Upgrade the existing Face Recognition Attendance System into an AI-powered CCTV-based surveillance and ERP platform.

The system should support:

- Multiple CCTV camera integration
- Real-time face recognition
- ERP management
- Attendance automation
- Person activity tracking
- Smart alerts
- Admin dashboard


# 2. Existing Technology Stack


## Frontend

- React + Vite
- JavaScript JSX
- CSS


## Backend

- Python FastAPI
- OpenCV
- YuNet face detection
- SFace face recognition


## Deployment

- Docker
- Docker Compose


## Database

- PostgreSQL using Docker


---

# 3. Development Rules

- Continue the existing Face-detection project.
- Do not create a completely new project.
- Reuse existing YuNet and SFace implementation.
- Keep architecture simple and understandable.
- Do not create unnecessary files.
- Use meaningful filenames.
- Explain every file before creating it.
- Write beginner-friendly code.
- Avoid unnecessary design patterns.
- Add comments for complex logic.
- Complete one phase before moving to the next phase.


---

# 4. Main Goal

Build an AI-powered CCTV Face Recognition ERP System.


The system should contain these modules:


# Module 1: CCTV Camera Integration


## Objective

Connect IP CCTV cameras and perform real-time face detection and recognition.


## Features

- Connect CCTV using RTSP stream.
- Manage multiple CCTV cameras.
- Read live video streams.
- Detect faces from CCTV frames.
- Recognize registered persons.


## Camera Information

Store:

- Camera ID
- Camera Name
- Location
- RTSP URL
- Camera Status (Online/Offline)


Example:


Camera:

Bus CCTV


Location:

College Bus 1



Camera:

Classroom CCTV


Location:

Classroom A


---

# Module 2: ERP System


## Objective

Create an ERP module for managing people and organization data.


## Manage:

- Students
- Employees
- Teachers
- Departments
- Roles


## Person Information

Store:

- Name
- Email
- Phone
- Department
- Role
- Profile Image
- Face Embedding


## Admin Operations

Admin can:

- Add person
- Update person
- Delete person
- View registered people


---

# Module 3: Attendance Management


## Objective

Improve attendance tracking using CCTV recognition.


## Store Attendance:

- Person Name
- Camera Name
- Location
- Date
- Time
- Confidence Score


## Generate:

- Daily Attendance Reports
- Monthly Attendance Reports
- Entry Time
- Exit Time


---

# Module 4: Multi-Camera Person Activity Tracking


## Objective

Track a person's movement across different cameras.


Example:


Person:

Jayveer


Timeline:


08:00 AM

Detected in Bus CCTV



09:10 AM

Detected in Classroom CCTV



11:30 AM

Detected in Lab CCTV



## Store Activity Logs:

- Person ID
- Camera ID
- Location
- Timestamp
- Confidence Score
- Snapshot


Create activity timeline dashboard.


---

# Module 5: Smart Alert System


## Objective

Create rule-based alerts.


Example Rule:


If a person is detected in Bus CCTV

AND

The person is not detected in Classroom CCTV within expected time


THEN

Generate alert.



## Alert Information

Store:

- Person Name
- Last Detected Location
- Expected Location
- Time
- Reason
- Alert Status


---

# Module 6: AI Improvements


Current AI:

- YuNet
- SFace


Keep existing models.


Add support for:


## Object Tracking

Possible technologies:

- ByteTrack
- DeepSORT


## Person Re-identification

Possible technologies:

- OSNet ReID
- TorchReID


Purpose:

Identify the same person across different CCTV cameras.


---

# Module 7: Database Design


Use PostgreSQL with Docker.


Create tables:


## Users

Store:

- User information
- Role
- Department
- Face embedding



## Cameras

Store:

- Camera details
- Location
- RTSP URL
- Status



## Attendance

Store:

- Person attendance records



## ActivityLogs

Store:

- Person movement history



## Alerts

Store:

- Generated alerts


---

# Module 8: Dashboard


Create React dashboard.


## Pages


## 1. Login

User authentication.



## 2. Dashboard

Display:

- Total Users
- Active Cameras
- Today's Attendance
- Alerts



## 3. Camera Management

Features:

- Add Camera
- Update Camera
- View Camera Status



## 4. Live Monitoring

Features:

- View CCTV Stream
- Face Detection
- Recognition Result



## 5. Attendance

Features:

- Attendance Table
- Reports



## 6. Person Activity

Show:

- Person timeline
- Camera history
- Location movement



## 7. Alerts

Show:

- Alert list
- Alert details


---

# 9. Project Architecture Rules


Keep structure simple.


Backend should contain:

- API routes
- AI services
- Camera services
- Database models
- Utility functions


Frontend should contain:

- Pages
- Components
- API communication
- Styles


---

# 10. Implementation Phases


## Phase 1: Database Integration

Implement:

- PostgreSQL Docker setup
- Database models
- User management
- Store face registration data
- Attendance storage



## Phase 2: CCTV Integration

Implement:

- RTSP camera connection
- Camera management
- Live stream processing



## Phase 3: Multi Camera Activity

Implement:

- Event logging
- Person timeline
- Location history



## Phase 4: ERP Dashboard

Implement:

- User management
- Camera dashboard
- Attendance reports
- Analytics



## Phase 5: Advanced AI

Implement:

- Object tracking
- Person Re-identification
- Smart alerts


---

# Initial Task


Before writing code:


Create:

1. Updated folder structure

2. Database schema design

3. Backend API plan

4. Frontend page/component plan

5. Implementation roadmap


Do not generate code until the architecture is approved.