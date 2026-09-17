// Mock Data for CNP (Clubs & Projects Department)

export const mockStudents = [
  {
    id: "CNP2023001",
    name: "Vedant Sharma",
    rollId: "CNP2023001",
    course: "Computer Science & Engineering",
    year: "4th Year",
    email: "vedant@college.edu",
    avatar: "", // empty for initials fallback
    skills: ["React", "Node.js", "UI/UX Design", "CSS Grid", "Git"],
    clubs: ["Coding Club", "Robotics Club"],
    projects: ["Campus Navigation App", "Smart Lab Automation"],
    events: ["CodeQuest 2026", "RoboExpo 2026"],
    role: "Admin"
  },
  {
    id: "CNP2023002",
    name: "Priya Patel",
    rollId: "CNP2023002",
    course: "Information Technology",
    year: "4th Year",
    email: "priya.patel@college.edu",
    avatar: "",
    skills: ["Python", "Machine Learning", "Data Structures", "Docker"],
    clubs: ["Coding Club"],
    projects: ["AI Conversational Assistant", "Predictive Grade System"],
    events: ["ML Workshop 2026", "CodeQuest 2026"],
    role: "Office Bearer",
    position: "President",
    clubId: "club-coding"
  },
  {
    id: "CNP2023003",
    name: "Amit Singh",
    rollId: "CNP2023003",
    course: "Electronics & Communication",
    year: "3rd Year",
    email: "amit.singh@college.edu",
    avatar: "",
    skills: ["Event Management", "Public Speaking", "Video Editing", "PR"],
    clubs: ["Cultural Club", "Social Club"],
    projects: ["Campus Radio Setup"],
    events: ["Dance Off 2026", "Street Play Carnival"],
    role: "Office Bearer",
    position: "Event Manager",
    clubId: "club-cultural"
  },
  {
    id: "CNP2023012",
    name: "Rohan Gupta",
    rollId: "CNP2023012",
    course: "Mechanical Engineering",
    year: "3rd Year",
    email: "rohan.gupta@college.edu",
    avatar: "",
    skills: ["SolidWorks", "Arduino Programming", "CNC Machining", "Math"],
    clubs: ["Robotics Club"],
    projects: ["RoboWars Combat Bot", "Autonomous Rover"],
    events: ["Drone Race 2026", "RoboExpo 2026"],
    role: "Office Bearer",
    position: "Treasurer",
    clubId: "club-robotics"
  },
  {
    id: "CNP2024045",
    name: "Sneha Reddy",
    rollId: "CNP2024045",
    course: "Computer Science & Engineering",
    year: "2nd Year",
    email: "sneha.reddy@college.edu",
    avatar: "",
    skills: ["HTML", "CSS", "Figma", "JavaScript"],
    clubs: ["Coding Club", "Social Service Club"],
    projects: ["NGO Donation Portal"],
    events: ["Tree Plantation Drive 2026"],
    role: "Student"
  },
  {
    id: "CNP2025089",
    name: "Divya Nair",
    rollId: "CNP2025089",
    course: "Electrical Engineering",
    year: "1st Year",
    email: "divya.nair@college.edu",
    avatar: "",
    skills: ["Java Programming", "Creative Writing", "Sketching"],
    clubs: ["Creative Writing Club"],
    projects: ["Department Monthly Newsletter"],
    events: ["Poetry Slam 2026"],
    role: "Student"
  },
  {
    id: "CNP2023009",
    name: "Vikram Malhotra",
    rollId: "CNP2023009",
    course: "Computer Science & Engineering",
    year: "4th Year",
    email: "vikram.m@college.edu",
    avatar: "",
    skills: ["React Native", "Firebase", "Adobe Illustrator", "Swift"],
    clubs: ["Coding Club"],
    projects: ["Campus Navigation App"],
    events: ["CodeQuest 2026"],
    role: "Office Bearer",
    position: "Technical Head",
    clubId: "club-coding"
  },
  {
    id: "CNP2024021",
    name: "Ananya Iyer",
    rollId: "CNP2024021",
    course: "Chemical Engineering",
    year: "2nd Year",
    email: "ananya.i@college.edu",
    avatar: "",
    skills: ["Graphic Design", "Photoshop", "Social Media Marketing"],
    clubs: ["Creative Writing Club"],
    projects: ["Department Monthly Newsletter"],
    events: ["Poetry Slam 2026"],
    role: "Office Bearer",
    position: "Graphic Designer",
    clubId: "club-creative"
  },
  {
    id: "CNP_FAC_001",
    name: "Dr. Rahul Verma",
    rollId: "CNP_FAC_001",
    course: "Professor, CSE Dept",
    year: "Faculty Mentor",
    email: "r.verma@college.edu",
    avatar: "",
    skills: ["Research Guidance", "Algorithms", "AI Ethics"],
    clubs: ["Coding Club"],
    projects: ["AI Conversational Assistant", "Predictive Grade System"],
    events: [],
    role: "Mentor"
  },
  {
    id: "CNP_FAC_002",
    name: "Dr. Ananya Sen",
    rollId: "CNP_FAC_002",
    course: "Associate Professor, ECE Dept",
    year: "Faculty Mentor",
    email: "a.sen@college.edu",
    avatar: "",
    skills: ["Signal Processing", "VLSI Design", "Embedded Systems"],
    clubs: ["Robotics Club"],
    projects: ["RoboWars Combat Bot", "Smart Lab Automation"],
    events: [],
    role: "Mentor"
  }
];

export const mockClubs = [
  {
    id: "club-coding",
    name: "Coding Club",
    logo: "💻",
    category: "Technical",
    description: "The premier coding and software development community on campus. We organize hackathons, competitive programming contests, and development workshops.",
    mentor: "Dr. Rahul Verma",
    mentorId: "CNP_FAC_001",
    officeBearers: [
      { studentId: "CNP2023002", name: "Priya Patel", position: "President" },
      { studentId: "CNP2023009", name: "Vikram Malhotra", position: "Technical Head" }
    ],
    membersCount: 145,
    projects: ["Campus Navigation App", "AI Conversational Assistant", "Predictive Grade System"],
    events: ["CodeQuest 2026", "ML Workshop 2026"]
  },
  {
    id: "club-robotics",
    name: "Robotics Club",
    logo: "🤖",
    category: "Technical",
    description: "A hub for robotics enthusiasts to design, build, and program autonomous machines and combat robots. High tech labs and hands-on hardware design.",
    mentor: "Dr. Ananya Sen",
    mentorId: "CNP_FAC_002",
    officeBearers: [
      { studentId: "CNP2023012", name: "Rohan Gupta", position: "Treasurer" }
    ],
    membersCount: 88,
    projects: ["RoboWars Combat Bot", "Autonomous Rover", "Smart Lab Automation"],
    events: ["RoboExpo 2026", "Drone Race 2026"]
  },
  {
    id: "club-cultural",
    name: "Cultural Club",
    logo: "🎭",
    category: "Cultural",
    description: "Celebrating art, music, theater, and dance. Organizing the college's annual festivals, talent hunts, and creative showcases.",
    mentor: "Prof. S. Mukherji",
    mentorId: "",
    officeBearers: [
      { studentId: "CNP2023003", name: "Amit Singh", position: "Event Manager" }
    ],
    membersCount: 210,
    projects: ["Campus Radio Setup"],
    events: ["Dance Off 2026", "Street Play Carnival"]
  },
  {
    id: "club-creative",
    name: "Creative Writing Club",
    logo: "✍️",
    category: "Creative",
    description: "Fostering literature, poetry, debate, and journalism. We publish the monthly newsletter and host poetry slams and debates.",
    mentor: "Dr. Sarah D'Souza",
    mentorId: "",
    officeBearers: [
      { studentId: "CNP2024021", name: "Ananya Iyer", position: "Graphic Designer" }
    ],
    membersCount: 65,
    projects: ["Department Monthly Newsletter"],
    events: ["Poetry Slam 2026"]
  },
  {
    id: "club-sports",
    name: "Sports Club",
    logo: "⚽",
    category: "Sports",
    description: "Encouraging sportsmanship and fitness. Managing college sports teams for football, basketball, cricket, and organizing inter-college leagues.",
    mentor: "Coach Raj Singh",
    mentorId: "",
    officeBearers: [],
    membersCount: 180,
    projects: [],
    events: ["Inter-Dept Football League"]
  },
  {
    id: "club-social",
    name: "Social Service Club",
    logo: "🤝",
    category: "Social",
    description: "Dedicated to social welfare and community engagement. Organizing blood donation drives, teaching local children, and environmental initiatives.",
    mentor: "Dr. M. R. Mehta",
    mentorId: "",
    officeBearers: [],
    membersCount: 120,
    projects: ["NGO Donation Portal"],
    events: ["Tree Plantation Drive 2026", "Blood Donation Camp"]
  }
];

export const mockProjects = [
  {
    id: "proj-nav",
    name: "Campus Navigation App",
    team: ["Vedant Sharma", "Vikram Malhotra"],
    department: "Computer Science & Engineering",
    status: "In Progress",
    progress: 75,
    deadline: "2026-09-15",
    description: "An interactive indoor navigation system mapping college buildings, classrooms, and labs utilizing BLE beacons.",
    clubId: "club-coding"
  },
  {
    id: "proj-smartlab",
    name: "Smart Lab Automation",
    team: ["Vedant Sharma", "Sneha Reddy"],
    department: "Electrical Engineering",
    status: "Approved",
    progress: 100,
    deadline: "2026-05-10",
    description: "IoT automation system for laboratory power sockets, temperature monitoring, and biometric locker access.",
    clubId: "club-robotics"
  },
  {
    id: "proj-ai",
    name: "AI Conversational Assistant",
    team: ["Priya Patel"],
    department: "Information Technology",
    status: "Under Review",
    progress: 90,
    deadline: "2026-08-30",
    description: "LLM agent customized with college curriculum and schedules to answer academic queries for students.",
    clubId: "club-coding"
  },
  {
    id: "proj-bot",
    name: "RoboWars Combat Bot",
    team: ["Rohan Gupta"],
    department: "Mechanical Engineering",
    status: "In Progress",
    progress: 45,
    deadline: "2026-10-01",
    description: "A 30-lbs active weapon spinner combat robot designed for the national robotics competition.",
    clubId: "club-robotics"
  },
  {
    id: "proj-news",
    name: "Department Monthly Newsletter",
    team: ["Ananya Iyer", "Divya Nair"],
    department: "Creative Writing",
    status: "Completed",
    progress: 100,
    deadline: "2026-07-31",
    description: "Designing and editing the monthly digital and print newsletter tracking achievements and announcements.",
    clubId: "club-creative"
  },
  {
    id: "proj-ngo",
    name: "NGO Donation Portal",
    team: ["Sneha Reddy"],
    department: "Computer Science & Engineering",
    status: "Submitted",
    progress: 95,
    deadline: "2026-08-20",
    description: "A secure online payments portal and item request ledger linking student donors to local orphanages.",
    clubId: "club-social"
  }
];

export const mockEvents = [
  {
    id: "evt-codequest",
    name: "CodeQuest 2026",
    date: "2026-08-20",
    time: "10:00 AM - 05:00 PM",
    venue: "Main Computer Lab 3",
    organizer: "Coding Club",
    participants: 120,
    status: "Upcoming",
    description: "A 7-hour rapid hackathon focused on solving real-world civic problems around transportation and safety."
  },
  {
    id: "evt-ml",
    name: "ML Workshop 2026",
    date: "2026-08-22",
    time: "02:00 PM - 05:00 PM",
    venue: "Seminar Hall A",
    organizer: "Coding Club",
    participants: 75,
    status: "Upcoming",
    description: "Introductory seminar on training and fine-tuning open-source LLMs on local consumer laptops."
  },
  {
    id: "evt-robo",
    name: "RoboExpo 2026",
    date: "2026-08-25",
    time: "09:00 AM - 04:00 PM",
    venue: "College Gymnasium",
    organizer: "Robotics Club",
    participants: 200,
    status: "Upcoming",
    description: "Exhibition showcasing final year robotics projects, autonomous drones, and student combat bots."
  },
  {
    id: "evt-dance",
    name: "Dance Off 2026",
    date: "2026-08-28",
    time: "05:30 PM - 08:30 PM",
    venue: "Open Air Theater",
    organizer: "Cultural Club",
    participants: 350,
    status: "Upcoming",
    description: "Inter-collegiate dance and choreography showcase featuring classical, modern, and street styles."
  },
  {
    id: "evt-poetry",
    name: "Poetry Slam 2026",
    date: "2026-09-02",
    time: "03:00 PM - 05:00 PM",
    venue: "Library Reading Room",
    organizer: "Creative Writing Club",
    participants: 40,
    status: "Upcoming",
    description: "An evening of spoken word, original poetry readings, and open-mic discussions."
  },
  {
    id: "evt-plantation",
    name: "Tree Plantation Drive",
    date: "2026-08-10",
    time: "08:00 AM - 12:00 PM",
    venue: "North Campus Grounds",
    organizer: "Social Service Club",
    participants: 110,
    status: "Completed",
    description: "An eco-friendly initiative planting 500 sapling trees on the campus border."
  }
];

export const mockInventory = [
  { id: "inv-001", name: "Arduino Uno R3 Kit", category: "Microcontrollers", total: 30, available: 18, issued: 10, damaged: 2 },
  { id: "inv-002", name: "Raspberry Pi 4 (8GB)", category: "Single Board Computers", total: 15, available: 5, issued: 9, damaged: 1 },
  { id: "inv-003", name: "DSLR Camera Canon EOS", category: "Media & Recording", total: 5, available: 2, issued: 3, damaged: 0 },
  { id: "inv-004", name: "Studio Microphone & Stand", category: "Media & Recording", total: 8, available: 6, issued: 2, damaged: 0 },
  { id: "inv-005", name: "Digital Projector EPSON", category: "Presentation", total: 6, available: 4, issued: 1, damaged: 1 },
  { id: "inv-006", name: "Soldering Station Hakko", category: "Lab Tools", total: 12, available: 10, issued: 0, damaged: 2 },
  { id: "inv-007", name: "3D Printer Creality Ender 3", category: "Lab Tools", total: 4, available: 2, issued: 2, damaged: 0 },
  { id: "inv-008", name: "Ultrasonic Sensors HC-SR04", category: "Sensors & Components", total: 100, available: 85, issued: 15, damaged: 0 }
];

export const mockApprovals = [
  {
    id: "app-001",
    type: "Event Request",
    title: "ML Workshop 2026 Setup",
    submittedBy: "Priya Patel",
    club: "Coding Club",
    dateSubmitted: "2026-08-12",
    details: "Requesting seminar hall booking, audio system, and budget of $50 for refreshments.",
    status: "Pending"
  },
  {
    id: "app-002",
    type: "Club Audit",
    title: "Annual Sports Club Audit",
    submittedBy: "Coach Raj Singh",
    club: "Sports Club",
    dateSubmitted: "2026-08-11",
    details: "Submission of budget sheet and expense reports for equipment purchased in Spring semester.",
    status: "Pending"
  },
  {
    id: "app-003",
    type: "Project Submission",
    title: "NGO Donation Portal Deploy",
    submittedBy: "Sneha Reddy",
    club: "Social Service Club",
    dateSubmitted: "2026-08-13",
    details: "Final source code and project documentation upload for evaluation by department head.",
    status: "Pending"
  },
  {
    id: "app-004",
    type: "Inventory Request",
    title: "2x Raspberry Pi 4 Issue",
    submittedBy: "Vikram Malhotra",
    club: "Coding Club",
    dateSubmitted: "2026-08-14",
    details: "Needs units to implement neural net inference servers for testing campus chatbot API.",
    status: "Pending"
  },
  {
    id: "app-005",
    type: "Event Request",
    title: "Poetry Slam 2026 Catering",
    submittedBy: "Ananya Iyer",
    club: "Creative Writing Club",
    dateSubmitted: "2026-08-09",
    details: "Requesting tea and cookie service for 40 writers in the library reading room.",
    status: "Approved"
  },
  {
    id: "app-006",
    type: "Inventory Request",
    title: "DSLR Camera Issue",
    submittedBy: "Amit Singh",
    club: "Cultural Club",
    dateSubmitted: "2026-08-08",
    details: "For event photography during Street Play Carnival.",
    status: "Rejected"
  },
  {
    id: "app-007",
    type: "Project Submission",
    title: "Department Newsletter Design",
    submittedBy: "Ananya Iyer",
    club: "Creative Writing Club",
    dateSubmitted: "2026-07-29",
    details: "Newsletter mockup PDF evaluation.",
    status: "Approved"
  }
];

export const mockRecentActivities = [
  { id: "act-1", text: "Dr. Rahul Verma approved 'ML Workshop 2026' event request", time: "2 hours ago" },
  { id: "act-2", text: "Priya Patel assigned Vikram Malhotra as Technical Head of Coding Club", time: "4 hours ago" },
  { id: "act-3", text: "Sneha Reddy submitted project 'NGO Donation Portal' for review", time: "1 day ago" },
  { id: "act-4", text: "Rohan Gupta requested 2x Arduino Uno from inventory", time: "1 day ago" },
  { id: "act-5", text: "Vedant Sharma updated project progress of 'Campus Navigation App' to 75%", time: "2 days ago" }
];
