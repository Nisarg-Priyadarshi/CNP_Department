
export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  universityId?: string;
  phone?: string;
  bio?: string;
  profileImage?: string;
}

export interface Club {
  _id: string;
  name: string;
  description: string;
  facultyCoordinatorId?: string | { _id: string; name: string };
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  teamLeaderId?: string | { _id: string; name: string };
  image?: string;
}
