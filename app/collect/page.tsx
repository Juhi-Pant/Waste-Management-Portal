'use client'
import { useState, useEffect } from 'react'
import { Trash2, MapPin, CheckCircle, Clock, ArrowRight, Camera, Upload, Loader, Calendar, Weight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { getWasteCollectionTasks, updateTaskStatus, saveReward, saveCollectedWaste, getUserByEmail } from '@/utils/db/actions'
import { GoogleGenerativeAI } from "@google/generative-ai"

// Make sure to set your Gemini API key in your environment variables
const geminiApiKey = process.env.GEMINI_API_KEY

type CollectionTask = {
  id: number
  location: string
  wasteType: string
  amount: string
  status: 'pending' | 'in_progress' | 'completed' | 'verified'
  date: string
  collectorId: number | null
}

const ITEMS_PER_PAGE = 5

export default function CollectPage() {
  const [tasks, setTasks] = useState<CollectionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredWasteType, setHoveredWasteType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isCollector, setIsCollector] = useState(false)
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);


  useEffect(() => {
    const fetchUserAndTasks = async () => {
      setLoading(true)
      try {
        const storedUserRole = localStorage.getItem('userRole')
        setUserRole(storedUserRole)
        setIsCollector(storedUserRole === 'collector')
        // Fetch user
        const userEmail = localStorage.getItem('userEmail')
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail)
          if (fetchedUser) {
            setUser(fetchedUser)
          } else {
            toast.error('User not found. Please log in again.')
            // Redirect to login page or handle this case appropriately
          }
        } else {
          toast.error('User not logged in. Please log in.')
          // Redirect to login page or handle this case appropriately
        }

        // Fetch tasks
        const fetchedTasks = await getWasteCollectionTasks()
        setTasks(fetchedTasks as CollectionTask[])
      } catch (error) {
        console.error('Error fetching user and tasks:', error)
        toast.error('Failed to load user data and tasks. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchUserAndTasks()
  }, [])

  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null)
 const [beforeImage, setBeforeImage] = useState<File | null>(null);
 const [afterImage, setAfterImage] = useState<File | null>(null);
 const [beforeImageBase64, setBeforeImageBase64] = useState<string | null>(null);
const [afterImageBase64, setAfterImageBase64] = useState<string | null>(null);

  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failure'>('idle')
  const [verificationResult, setVerificationResult] = useState<{
    wasteTypeMatch: boolean;
    quantityMatch: boolean;
    confidence: number;
    sameLocation: boolean;
    cleaned: boolean;
  } | null>(null)
  const [reward, setReward] = useState<number | null>(null)

  const handleStatusChange = async (taskId: number, newStatus: CollectionTask['status']) => {
    if(newStatus=== 'in_progress' && navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        (position)=> {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setLocationCoords(coords)
          console.log('latitude and longitude ', coords)
        },
        (error) => {
          console.error('Geolocation error ', error)
        }
      )
    }
    if (!user) {
      toast.error('Please log in to collect waste.')
      return
    }
    if (!isCollector) {
      toast.error('Only waste collectors can collect waste. Please contact support if you are a collector.')
      return
    }

    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus, user.id)
      if (updatedTask) {
        setTasks(tasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus, collectorId: user.id } : task
        ))
        toast.success('Task status updated successfully')
      } else {
        toast.error('Failed to update task status. Please try again.')
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status. Please try again.')
    }
  }

  const handleImageUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  type: 'before' | 'after'
) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1]; // Strip metadata
      if (type === 'before') {
        setBeforeImageBase64(base64String);
      } else {
        setAfterImageBase64(base64String);
      }
    };
    reader.readAsDataURL(file);
  }
};


  const readFileAsBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1]
  }

  const handleVerify = async () => {
  if (!selectedTask || !beforeImageBase64 || !afterImageBase64 || !user) {
    toast.error('Missing required information for verification.');
    return;
  }

  if (!isCollector) {
    toast.error('Only waste collectors can verify waste collection.');
    return;
  }

  setVerificationStatus('verifying');

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Get geolocation
    let currentLocation: { lat: number, lng: number } | null = null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      console.log('Collector location points: ', currentLocation);
    } catch (err) {
      console.warn('Unable to fetch location. Proceeding without it.');
    }

    const imageParts = [
      {
        inlineData: {
          data: beforeImageBase64,
          mimeType: 'image/jpeg',
        },
      },
      {
        inlineData: {
          data: afterImageBase64,
          mimeType: 'image/jpeg',
        },
      },
    ];

    const prompt = `You are an expert in waste collection verification. Analyze the two images (before and after) and determine:

1. Is it the *same location* in both images? (Look at background, landmarks, angles)
2. Does the *after* image show that the area is now clean and waste has been removed?
3. Does the visible waste type match the reported type: ${selectedTask.wasteType}?
4. Does the quantity appear consistent with the reported: ${selectedTask.amount}?

- Estimate: 1 garbage bag ≈ 5kg, small basket ≈ 2kg, 1 sq.m. pile ≈ 5–7kg.
- If unclear, assume quantity is accurate unless obvious mismatch.

5. The collector's current location is:
${currentLocation ? `Latitude: ${currentLocation.lat}, Longitude: ${currentLocation.lng}` : 'Not Available'}

Assume the task location is: "${selectedTask.location}"

Compare the two and check if the collector was likely on-site.

Respond in JSON format like:
{
  "sameLocation": true,
  "cleaned": true,
  "wasteTypeMatch": true,
  "quantityMatch": true,
  "confidence": 0.92
}`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const rawText = response.text();
    console.log("Raw Gemini response:", rawText);

    // Clean Gemini JSON response
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in the response");
  }

    try {
      const parsedResult = JSON.parse(jsonMatch[0]);

      setVerificationResult({
        sameLocation: parsedResult.sameLocation,
        cleaned: parsedResult.cleaned,
        wasteTypeMatch: parsedResult.wasteTypeMatch,
        quantityMatch: parsedResult.quantityMatch,
        confidence: parsedResult.confidence,
      });

      setVerificationStatus('success');

      if (
        parsedResult.sameLocation &&
        parsedResult.cleaned &&
        parsedResult.wasteTypeMatch &&
        parsedResult.quantityMatch &&
        parsedResult.confidence > 0.7
      ) {
        await handleStatusChange(selectedTask.id, 'verified');
        const earnedReward = Math.floor(Math.random() * 50) + 10; // Random reward between 10 and 59

        await saveReward(user.id, earnedReward);
        await saveCollectedWaste(selectedTask.id, user.id, parsedResult);

        setReward(earnedReward);
        toast.success(`Verification successful! You earned ${earnedReward} tokens!`, {
          duration: 5000,
          position: 'top-center',
        });
      } else {
        toast.error('Verification failed. The collected waste does not match the report.', {
          duration: 5000,
          position: 'top-center',
        });
      }
    } catch (error) {
      console.error('Failed to parse JSON response:', cleanText);
      setVerificationStatus('failure');
    }
  } catch (error) {
    console.error('Error verifying waste:', error);
    setVerificationStatus('failure');
  }
};

  const filteredTasks = tasks.filter(task =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pageCount = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE)
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )
  
  
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Waste Collection Tasks</h1>
      
      <div className="mb-4 flex items-center">
        <Input
          type="text"
          placeholder="Search by area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mr-2"
        />
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {!isCollector ? (
        <div className="flex justify-center items-center h-64">
          
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Restricted</h2>
          <p className="text-gray-600 mb-4">
            This page is only accessible to waste collectors. 
            If you are a waste collector and seeing this message, please contact support.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {userRole || 'Not assigned'}
          </p>
        </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedTasks.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                    {task.location}
                  </h2>
                  <StatusBadge status={task.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-center relative">
                    <Trash2 className="w-4 h-4 mr-2 text-gray-500" />
                    <span 
                      onMouseEnter={() => setHoveredWasteType(task.wasteType)}
                      onMouseLeave={() => setHoveredWasteType(null)}
                      className="cursor-pointer"
                    >
                      {task.wasteType.length > 8 ? `${task.wasteType.slice(0, 8)}...` : task.wasteType}
                    </span>
                    {hoveredWasteType === task.wasteType && (
                      <div className="absolute left-0 top-full mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                        {task.wasteType}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <Weight className="w-4 h-4 mr-2 text-gray-500" />
                    {task.amount}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    {task.date}
                  </div>
                </div>
                <div className="flex justify-end">
                  {task.status === 'pending' && (
                    <Button onClick={() => handleStatusChange(task.id, 'in_progress')} variant="outline" size="sm">
                      Start Collection
                    </Button>
                  )}
                  {task.status === 'in_progress' && task.collectorId === user?.id && (
                    <Button onClick={() => setSelectedTask(task)} variant="outline" size="sm">
                      Complete & Verify
                    </Button>
                  )}
                  {task.status === 'in_progress' && task.collectorId !== user?.id && (
                    <span className="text-yellow-600 text-sm font-medium">In progress by another collector</span>
                  )}
                  {task.status === 'verified' && (
                    <span className="text-green-600 text-sm font-medium">Reward Earned</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="mr-2"
            >
              Previous
            </Button>
            <span className="mx-2 self-center">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
              disabled={currentPage === pageCount}
              className="ml-2"
            >
              Next
            </Button>
          </div>
        </>
      )}

      {selectedTask && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-xl font-semibold mb-4">Verify Collection</h3>
      <p className="mb-4 text-sm text-gray-600">
        Upload before and after images of the waste collection to verify and earn your reward.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        {/* Before Image Upload */}
        <div>
          <label htmlFor="before-image" className="block text-sm font-medium text-gray-700 mb-2">
            Before Collection
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <label
                htmlFor="before-image"
                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"
              >
                <span>Upload Before</span>
                <input
                  id="before-image"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setBeforeImage(file);
                    if(file){
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        setBeforeImageBase64(base64String);
                      }
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
          {beforeImage && (
            <img
              src={URL.createObjectURL(beforeImage)}
              alt="Before Collection"
              className="mt-3 rounded-md w-full"
            />
          )}
        </div>

        {/* After Image Upload */}
        <div>
          <label htmlFor="after-image" className="block text-sm font-medium text-gray-700 mb-2">
            After Collection
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <label
                htmlFor="after-image"
                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"
              >
                <span>Upload After</span>
                <input
                  id="after-image"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAfterImage(file);
                    if(file){
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        setAfterImageBase64(base64String);
                      }
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
          {afterImage && (
            <img
              src={URL.createObjectURL(afterImage)}
              alt="After Collection"
              className="mt-3 rounded-md w-full"
            />
          )}
        </div>
      </div>

      <Button
        onClick={handleVerify}
        className="w-full"
        disabled={!beforeImage || !afterImage || verificationStatus === 'verifying'}
      >
        {verificationStatus === 'verifying' ? (
          <>
            <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
            Verifying...
          </>
        ) : (
          'Verify Collection'
        )}
      </Button>

      {verificationStatus === 'success' && verificationResult && (
  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="font-medium">✅ Waste Type Match:</span>
      <span className={verificationResult.wasteTypeMatch ? 'text-green-700' : 'text-red-600'}>
        {verificationResult.wasteTypeMatch ? 'Yes' : 'No'}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="font-medium">✅ Quantity Match:</span>
      <span className={verificationResult.quantityMatch ? 'text-green-700' : 'text-red-600'}>
        {verificationResult.quantityMatch ? 'Yes' : 'No'}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="font-medium">📍 Same Location:</span>
      <span className={verificationResult.sameLocation ? 'text-green-700' : 'text-red-600'}>
        {verificationResult.sameLocation ? 'Yes' : 'No'}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="font-medium">🧹 Area Cleaned:</span>
      <span className={verificationResult.cleaned ? 'text-green-700' : 'text-red-600'}>
        {verificationResult.cleaned ? 'Yes' : 'No'}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="font-medium">📊 Confidence:</span>
      <span className="text-blue-700 font-semibold">
        {(verificationResult.confidence * 100).toFixed(2)}%
      </span>
    </div>
  </div>
)}


      {verificationStatus === 'failure' && (
        <p className="mt-2 text-red-600 text-center text-sm">Verification failed. Please try again.</p>
      )}

      <Button onClick={() => setSelectedTask(null)} variant="outline" className="w-full mt-2">
        Close
      </Button>
    </div>
  </div>
)}

      {/* Add a conditional render to show user info or login prompt */}
      {/* {user ? (
        <p className="text-sm text-gray-600 mb-4">Logged in as: {user.name}</p>
      ) : (
        <p className="text-sm text-red-600 mb-4">Please log in to collect waste and earn rewards.</p>
      )} */}
    </div>
  )
}


function StatusBadge({ status }: { status: CollectionTask['status'] }) {
  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: Trash2 },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    verified: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  }

  const { color, icon: Icon } = statusConfig[status]

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color} flex items-center`}>
      <Icon className="mr-1 h-3 w-3" />
      {status.replace('_', ' ')}
    </span>
  )
}