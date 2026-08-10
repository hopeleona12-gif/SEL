import { Route, Routes } from 'react-router-dom'
import { AssessmentProvider } from './context'
import { Report } from './pages'
import { TrialsPage } from './assessment/TrialsPage'
import {
  Done,
  Home,
  PracticeComplete,
  PracticeIntro,
  Rule,
} from './taskFlowPages'
export default function App(){return <AssessmentProvider><Routes>
  <Route path="/" element={<Home/>}/><Route path="/rule" element={<Rule/>}/>
  <Route path="/practice-intro" element={<PracticeIntro/>}/>
  <Route path="/practice" element={<TrialsPage key="practice" phase="practice"/>}/><Route path="/test" element={<TrialsPage key="test" phase="test"/>}/>
  <Route path="/practice-complete" element={<PracticeComplete/>}/>
  <Route path="/done" element={<Done/>}/><Route path="/report/:sessionId" element={<Report/>}/><Route path="*" element={<Home/>}/>
</Routes></AssessmentProvider>}
