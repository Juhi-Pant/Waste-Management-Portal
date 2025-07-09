'use client'
import {useState, useEffect} from 'react'
import './globals.css'
import {Toaster} from 'react-hot-toast'
import Header from '../components/Header'
import SideBar from '../components/Sidebar'
import { getAvailableRewards, getUserByEmail } from '@/utils/db/actions'

//header




export default function RootLayout ({
  children,
}:Readonly<{
  children: React.ReactNode
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [totalEarning, setTotalEarning] = useState(0)

  type Reward = {
  id: number;
  name: string;
  cost: number;
  description: string | null;
  collectionInfo: string;
};


  useEffect(() => {
    const fetchTotalEarnings = async () => {
      try {
        const userEmail = localStorage.getItem('userEmail');
        if(userEmail){
          const user = await getUserByEmail(userEmail)
          if(user){
            const availRewards = await getAvailableRewards(user.id) as Reward[];
            const total = availRewards.reduce((sum, reward) => sum + reward.cost, 0); 
            setTotalEarning(total);
            
          }
        }
      } catch (error) {
        console.error('Error fetching total earnings ',error)
      }
    };
    fetchTotalEarnings()
  }, [])
  return (
    <html lang='en'>
      <body className='{inter.className'>
        <div className='min-h-screen bg-gray-50 flex-col'>
          {/* header */}
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} totalEarnings={totalEarning}/>
          <div className='flex flex-1'>
            {/* Sidebar */}
            <SideBar open={sidebarOpen}/>
            <main className='flex-1 p-4 lg:p-8 lg: ml-64 transition-all duration-300'>
              {children}
            </main>
          </div>
        </div>
        <Toaster/>
      </body>
    </html>
  )
}



//sidebar

