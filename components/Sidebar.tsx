import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Button} from './ui/button'
import {MapPin, Trash, Coins, Medal, Settings, Home} from 'lucide-react'

const sideBarItems = [
    {href: '/', label: 'Home', icon: Home},
    {href: '/reports', label:'Report Waste', icon: MapPin},
    {href: '/collect', label: 'Collect Waste', icon: Trash}, 
    {href: '/rewards', label: 'Rewards', icon: Coins},
    {href: '/leaderboard', label: 'Leaderboard', icon: Medal}
]
interface sideBarProps {
    open: boolean;
}
export default function Sidebar({open}: sideBarProps){
    const pathname = usePathname();
    return (
        <aside className={`bg-white border-r pt-20 border-gray-200 text-gray-800 w-64 fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${open? 'translate-x-0':'-translate-x-full'} lg:translate-x-0`}>
            <nav className='h-full flex flex-col justify-between'>
                <div className='px-4 py-6 space-y-4'>
                    {
                        sideBarItems.map((item) => (

                            <Link href={item.href} key={item.href} passHref>
                                <Button variant={pathname==item.href? 'secondary':'ghost'} className={`w-full justify-start py-3 ${pathname==item.href? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100' }`}>
                                    <item.icon className='mr-3 h-5 w-5'/>
                                    <span className='text-base'>{item.label}</span>
                                </Button>
                            </Link>
                        ))
                    }
                    </div>
                <div className='p-4 border-t border-gray-200 '>
                    <Link href='/settings' passHref>
                       <Button variant={pathname=='/settings'?'secondary':'outline'} className={`w-full py-3 ${pathname == '/settings' ? 'bg-green-100 text-green-800': 'text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                          <Settings className='mr-3 h-5 w-5'/>
                          <span className='text-base'>Settings</span>
                       </Button>
                    </Link>
                </div>
            </nav>
        </aside>
    )
}