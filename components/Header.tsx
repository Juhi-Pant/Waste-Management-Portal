//@ts-nocheck
'use client'
import {useState, useEffect} from 'react'
import {createUser, getUserByEmail, getUnreadNotifications, getUserBalance, markNotificationAsRead} from '@/utils/db/actions'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Button} from './ui/button'
import { DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Badge } from "@/components/ui/badge"
import {Web3Auth} from '@web3auth/modal'
import {CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK} from '@web3auth/base'
import {EthereumPrivateKeyProvider} from '@web3auth/ethereum-provider'
//import {useMediaQuery} from ''
import {Menu, Coins, Leaf, Search, Bell, User, LogOut, ChevronDown, LogIn} from 'lucide-react'
import {useMediaQuery} from '@/hook/useMediaQuery'
import { confirmAlert } from 'react-confirm-alert'
import 'react-confirm-alert/src/react-confirm-alert.css'; 
import { title } from 'process'

const clientId = process.env.WEB3_CLIENT_ID || '';

const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: '0xaa36a7',
    rpcTarget: 'https://rpc.ankr.com/eth_sepolia/91150a2c4f5bb2c52f6b8699779ca8a94d4c1400c9ea3468cc52117f71d3df69',
    displayName: 'Sepolia Testnet',
    blockExplorerId: 'https://sepolia.etherscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
}
const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
})
const web3Auth = new Web3Auth({
    clientId,
    web3AuthNetwork:'sapphire_devnet',
    privateKeyProvider
})
interface HeaderProps {
    onMenuClick: () => void;
    totalEarnings: number
}

export default function Header ({onMenuClick, totalEarnings}: HeaderProps){
    const [provider, setProvider] = useState<IProvider | null>(null)
    const [loggedIn, setLoggedIn ]= useState(false)
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<any>(null)
    const pathName = usePathname()
    const[notification, setNotification] = useState<Notification[]>([])
    const[balance, setBalance] = useState(0)
    const isMobile = useMediaQuery("(max-width: 768px")
    const [isInitialized, setIsInitialized] = useState(false);
    useEffect(() => {
        const init = async() => {
            try {
                await web3Auth.initModal()
                setProvider(web3Auth.provider)
                setIsInitialized(true)
                if(web3Auth.connected){
                    setLoggedIn(true)
                    const user = await web3Auth.getUserInfo();
                    setUserInfo(user)
                    if(user.email){
                        localStorage.setItem('userEmail', user.email)
                        if(user.email){
                            localStorage.setItem('userEmail', user.email)
                            try {
                                await createUser(user.email, user.name || 'Anonymous user')
                            } catch (error) {
                                console.error('Error creating user', error)
                            }
                        }
                        
                    }
                }
            } catch (error) {
                console.error("Error init web3 auth", error)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, []);

    useEffect(() => {
        const fetchNotifications = async () => {
            if(userInfo && userInfo.email){
                const user = await getUserByEmail(userInfo.email)
                if(user){
                    const unreadNotifications = await getUnreadNotifications(user.id)
                    setNotification(unreadNotifications)
                }
            }
        }
        fetchNotifications();
        const notificationInterval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(notificationInterval)
    }, [userInfo])

    useEffect(()=> {
        const fetchUserBalance = async () => {
            if(userInfo && userInfo.email){
                const user = await getUserByEmail(userInfo.email)
                if(user) {
                    const userBalance = await getUserBalance(user.id)
                    setBalance(userBalance)
                }
            }
        }
        fetchUserBalance()
        const handleBalanceUpdate = (event: CustomEvent) => {
            setBalance(event.detail)
        }
        window.addEventListener('balanceUpdate', handleBalanceUpdate as EventListener)
        return () => {
            window.removeEventListener('balanceUpdate', handleBalanceUpdate as EventListener)
        }
    }, [userInfo])

    const handelLogin = async () => {
        if(!web3Auth) {
            console.log('Not initialised web3Auth')
            return;
        }
        try {
            if(!isInitialized || !web3Auth) {
                console.log('Web3Auth is not initialised yet')
                return;
            }
            const web3AuthProvider = await web3Auth.connect();
            setProvider(web3AuthProvider)
            setLoggedIn(true)
            const user = await web3Auth.getUserInfo();
            setUserInfo(user)
            if(user.email){
                localStorage.setItem('userEmail', user.email)
                const existingUser = await getUserByEmail(user.email);
                if(!existingUser){
                    confirmAlert({
                        title: 'User Role Selection',
                        message: 'Are you a waste collector?',
                        buttons: [
                            {
                                label: 'Yes, I am a collector',
                                onClick: async () => {
                                const role = 'collector';
                                try {
                                    await createUser(user.email, user.name || 'Anonymous User', role);
                                    localStorage.setItem('userRole', role);
                                } catch (error) {
                                    console.error('Error creating user', error)
                                }
                            }
                            }, 
                            {
                                label: 'No, I am a regular user',
                            onClick: async () => {
                                const role = 'user';
                                try {
                                    await createUser(user.email, user.name || 'Anonymous User', role);
                                    localStorage.setItem('userRole', role);
                                } catch (error) {
                                    console.error('Error creating user', error)
                                }
                            }
                            }
                        ]
                    })
                }
                else {
                    localStorage.setItem('userRole', existingUser.role);
                }
                
            }
        } catch (error) {
            console.error('Error logging in', error)
        }
    }
    const handleLogOut = async () => {
        if(!web3Auth){
            console.log('Not initialised web3Auth')
            return;
        }
        try {
            await web3Auth.logout();
            setProvider(null);
            setLoggedIn(false);
            setUserInfo(null);
            localStorage.removeItem('userEmail')
        } catch (error) {
            console.error('Error logging out', error)
        }
    }
    const getUserInfo = async () => {
        if(web3Auth.connected){
           const user = await web3Auth.getUserInfo();
           setUserInfo(user);
           if(user.email){
            localStorage.setItem('useEmail', user.email)
            try {
                await createUser(user.email, user.name || 'Anonymous User')
             } catch (error) {
              
             }
           }
        }
    }
    const handleNotificationClick = async (notificationId: number) => {
        await markNotificationAsRead(notificationId);

    }
    if(loading) {
       return <div>Loading Web3 Auth.......</div> 
    }
    return (
        <header className='bg-white border-b border-gray-200 sticky top-0 z-50'>
            <div className='flex items-center justify-between px-4 py-2'>
              <div className='flex items-center'>
                <Button variant='ghost' size='icon' className='mr-2 md:mr-4' onClick={onMenuClick}>
                    <Menu className='h-6 w-6 text-gray-800'/>
                </Button>
                <Link href='/' className='flex items-center'>
                     <Leaf className='h-6 w-6 md:h-8 md:w-8 text-green-500 mr-1 md:mr-2'/>
                     <span className='font-bold text-base md:text-lg text-gray-800'>GreenAlly</span>
                </Link>
              </div>
              {!isMobile && (
                <div className='flex-1 max-w-xl mx-4'>
                  <div className='relative'>
                    <input 
                    type="text"
                    placeholder='Search...' 
                    className='w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500'
                    />
                    <Search className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400'/>
                  </div>
                </div>
              )}
              <div className='flex items-center'>
                {isMobile && (
                    <Button variant='ghost' size='icon' className='mr-2'>
                        <Search className='h-5 w-5'/>
                    </Button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='mr-2 relative'>
                           <Bell className='h-5 w-5 text-gray-800'/>
                           {notification.length > 0 && (
                            <Badge className='absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5'>
                                {notification.length}
                            </Badge>
                           )}
                        </Button>

                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-64'>
                        {notification.length >0 ? (
                            notification.map((notification:any) => (
                              <DropdownMenuItem key={notification.id} onClick={() => handleNotificationClick(notification.id)}>
                                <div className='flex-col'>
                                    <span className='font-medium '>{notification.type}</span>
                                    <span className='text-sm text-gray-500'>{notification.message}</span>
                                    </div>
                              </DropdownMenuItem>
                            ))
                        ): (
                            <DropdownMenuItem>No new notifications</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className='mr-2 md:mr-4 flex items-center bg-gray-100 rounded-full md:px-3 px-2 py-1'>
                    <Coins className='h-4 w-4 md:h-5 md:w-5 mr-1 text-green-500'/>
                    <span className='font-semibold text-sm md:text-base text-gray-800'>{balance.toFixed(2)}</span>
                </div>
                {!loggedIn ? (
                    <Button onClick={handelLogin} className=' bg-green-600 hover:bg-green-700 text-white text-sm md:text-base'>
                        Login
                        <LogIn className='ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5'/>

                    </Button>
                ): (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='items-center flex'>
                                <User className='h-5 w-5 mr-1'/>
                                <ChevronDown className='h-4 w-4'/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={getUserInfo}>
                                {userInfo? userInfo.name : 'Profile'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link href={'/settings'}>Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogOut}>
                                Logout
                            </DropdownMenuItem>

                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
              </div>
            </div>
        </header>
    )
    
}
 