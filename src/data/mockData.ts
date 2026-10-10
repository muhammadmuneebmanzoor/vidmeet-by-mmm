import { Meeting, Recording, Participant, ChatMessage, DeveloperProfile } from '../types';

export const INITIAL_DEVELOPER: DeveloperProfile = {
  name: 'Muhammad Muneeb Manzoor',
  role: 'Software Engineer',
  specialization: 'Full Stack, Mobile & Game Developer',
  bio1: 'I am a Software Engineer specializing in end-to-end full-stack development, mobile applications, and interactive game engineering. I build real-world, production-ready software solutions with modern architectures, clean code, and intuitive user experiences.',
  bio2: 'With extensive experience taking projects from concept to deployment, I specialize in responsive web platforms, cross-platform mobile apps, dynamic game engines, scalable REST & cloud backends, and generative AI systems.',
  skills: [
    'Full-Stack Web',
    'Mobile App Development',
    'Game Development',
    'Real-World Projects',
    'Generative AI Systems',
    'Cloud & REST APIs',
  ],
  email: 'muneebmanzoor1214@gmail.com',
  links: {
    linkedin: 'https://linkedin.com/in/muhammad-muneeb-manzoor',
    instagram: 'https://instagram.com/muneeb_manzoor',
    facebook: 'https://facebook.com/muhammad.muneeb.manzoor',
    github: 'https://github.com/muneebmanzoor',
  },
  copyright: '© 2026 VidMeet by Muhammad Muneeb Manzoor. All rights reserved.',
};

// No mock data - live meetings and recordings populated from PostgreSQL
export const INITIAL_MEETINGS: Meeting[] = [];
export const INITIAL_RECORDINGS: Recording[] = [];
export const INITIAL_PARTICIPANTS: Participant[] = [];
export const INITIAL_MESSAGES: ChatMessage[] = [];
