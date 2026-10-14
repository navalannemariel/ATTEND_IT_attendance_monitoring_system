import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyDn9pHrPjpspqd7L9sFKKfVG4Z_o0C1UtY',
  authDomain:        'hhca-attendance.firebaseapp.com',
  projectId:         'hhca-attendance',
  storageBucket:     'hhca-attendance.firebasestorage.app',
  messagingSenderId: '972011403792',
  appId:             '1:972011403792:web:87c06df6590bc2d02a2895',
};

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
