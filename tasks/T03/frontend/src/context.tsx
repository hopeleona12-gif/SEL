import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { TaskConfig } from './types'
type State={task:TaskConfig|null;setTask:(x:TaskConfig)=>void;sessionId:string;setSessionId:(x:string)=>void}
const Context=createContext<State|null>(null)
export function AssessmentProvider({children}:{children:ReactNode}){
  const [task,setTask]=useState<TaskConfig|null>(null);const [sessionId,setSessionId]=useState('')
  useEffect(() => {
    if (!sessionId) return
    const abortOnUnload = () => {
      navigator.sendBeacon(`/api/v1/assessments/${sessionId}/abort`)
    }
    window.addEventListener('beforeunload', abortOnUnload)
    return () => window.removeEventListener('beforeunload', abortOnUnload)
  }, [sessionId])
  return <Context.Provider value={{task,setTask,sessionId,setSessionId}}>{children}</Context.Provider>
}
export function useAssessment(){const value=useContext(Context);if(!value)throw Error('Missing provider');return value}
