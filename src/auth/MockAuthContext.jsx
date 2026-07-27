import {createContext,useContext} from 'react';
export const MockAuthContext=createContext(null);
export const useMockAuth=()=>useContext(MockAuthContext);
