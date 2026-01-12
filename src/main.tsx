import '@/index.css';

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '@/context/AuthContext.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './components/views/Login';
import CreateIndent from './components/views/CreateIndent';
import Dashboard from './components/views/Dashboard';
import App from './App';
import ApproveIndent from '@/components/views/ApproveIndent';
import { SheetsProvider } from './context/SheetsContext';
import VendorUpdate from './components/views/VendorUpdate';
import RateApproval from './components/views/RateApproval';
import StoreOutApproval from './components/views/StoreOutApproval';
import TrainnigVideo from './components/views/TrainingVideo';
import Liecense from './components/views/License'
import MakePayment from './components/views/MakePayment';
import type { RouteAttributes } from './types';
import {
    LayoutDashboard,
    ClipboardList,
    UserCheck,
    Users,
    ClipboardCheck,
    Truck,
    PackageCheck,
    ShieldUser,
    FilePlus2,
    ListTodo,
    Package2,
    Store,
    KeyRound,
    VideoIcon,
    RotateCcw
} from 'lucide-react';
import type { UserPermissions } from './types/sheets';
import Administration from './components/views/Administration';
import Loading from './components/views/Loading';
import CreatePO from './components/views/CreatePO';
import PendingIndents from './components/views/PendingIndents';
import Order from './components/views/Order';
import Inventory from './components/views/Inventory';
import POMaster from './components/views/POMaster';
import StoreIssue from './components/views/StoreIssue';
import QuantityCheckInReceiveItem from './components/views/QuantityCheckInReceiveItem';
import ReturnMaterialToParty from './components/views/ReturnMaterialToParty';
import SendDebitNote from './components/views/SendDebitNote';
import IssueData from './components/views/IssueData';
import GetLift from './components/views/GetLift';
import StoreIn from './components/views/StoreIn';
import AuditData from './components/views/AuditData';
import RectifyTheMistake from './components/views/RectifyTheMistake';
import ReauditData from './components/views/ReauditData';
import TakeEntryByTally from './components/views/TakeEntryByTally';
import ExchangeMaterials from './components/views/ExchangeMaterials';
import DBforPc from './components/views/DBforPC';
import AgainAuditing from './components/views/AgainAuditing'
import BillNotReceived from './components/views/BillNotReceived';
import FullKiting from './components/views/FullKiting';
import PendingPo from './components/views/PendingPo';
import PaymentStatus from './components/views/PaymentStatus';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { loggedIn, loading } = useAuth();
    if (loading) return <Loading />;
    return loggedIn ? children : <Navigate to="/login" />;
}

function GatedRoute({
    children,
    identifier,
}: {
    children: React.ReactNode;
    identifier?: keyof UserPermissions;
}) {
    const { user } = useAuth();
    if (!identifier) return children;
    if (!user || !(user as any)[identifier]) {
        return <Navigate to="/" replace />;
    }
    return children;
}

const routes: RouteAttributes[] = [
    {
        path: '',
        name: 'Dashboard',
        icon: <LayoutDashboard size={20} />,
        element: <Dashboard />,
        notifications: () => 0,
    },
    {
        path: 'store-issue',
        gateKey: 'storeIssue',
        name: 'Store Issue',
        icon: <ClipboardList size={20} />,
        element: <StoreIssue />,
        notifications: () => 0,
    },

     {
    path: 'Issue-data',
    gateKey: 'issueDataView', // ✅ CHANGE: Use issueDataView for viewing permission
    name: 'Issue Data',
    icon: <ClipboardCheck size={20} />,
    element: <IssueData />,
    notifications: (issueSheet: any[]) =>
        issueSheet.filter((sheet: any) =>
            sheet.planned1 &&
            sheet.planned1.toString().trim() !== '' &&
            (!sheet.actual1 || sheet.actual1.toString().trim() === '')
        ).length,
},


    {
        path: 'inventory',
        name: 'Inventory',
        gateKey: 'inventory',
        icon: <Store size={20} />,
        element: <Inventory />,
        notifications: () => 0,
    },
    

    {
        path: 'create-indent',
        gateKey: 'createIndent',
        name: 'Create Indent',
        icon: <ClipboardList size={20} />,
        element: <CreateIndent />,
        notifications: () => 0,
    },
    {
        path: 'approve-indent',
        gateKey: 'indentApprovalView',
        name: 'Approve Indent',
        icon: <ClipboardCheck size={20} />,
        element: <ApproveIndent />,
        notifications: (sheets: any[]) =>
            sheets.filter(
                (sheet: any) =>
                    sheet.planned1 !== '' &&
                    sheet.vendorType === '' 
            ).length,
    },
    {
        path: 'vendor-rate-update',
        gateKey: 'updateVendorView',
        name: 'Vendor Rate Update',
        icon: <UserCheck size={20} />,
        element: <VendorUpdate />,
        notifications: (sheets: any[]) =>
            sheets.filter((sheet: any) => sheet.planned2 !== '' && sheet.actual2 === '').length,
    },
    {
        path: 'three-party-approval',
        gateKey: 'threePartyApprovalView',
        name: 'Three Party Approval',
        icon: <Users size={20} />,
        element: <RateApproval />,
        notifications: (sheets: any[]) =>
            sheets.filter(
                (sheet: any) =>
                    sheet.planned3 !== '' &&
                    sheet.actual3 === '' &&
                    sheet.vendorType === 'Three Party'
            ).length,
    },
   {
    path: 'pending-pos',
    gateKey: 'pendingIndentsView',
    name: 'PO to Make/Not',
    icon: <ListTodo size={20} />,
    element: <PendingIndents />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.status === "Pending" && 
            sheet.approvedVendorName && 
            sheet.approvedVendorName.toString().trim() !== '' &&
            (!sheet.poRequred || 
             sheet.poRequred.toString().trim() === '' || 
             sheet.poRequred.toString().trim() === 'undefined' ||
             sheet.poRequred === null)
        ).length,
},

 {
    path: 'pending-poss',
    gateKey: 'pendingPo', // ✅ CHANGE: lowercase 'o'
    name: 'Pending PO',
    icon: <FilePlus2 size={20} />,
    element: <PendingPo />,
    notifications: (sheets: any[]) => {
        // Count only items that are likely NOT in PO Master yet
        // This approximates the PO Master filter by checking for pending status indicators
        return sheets.filter((sheet: any) => 
            sheet.poRequred && 
            sheet.poRequred.toString().trim() === 'Yes' &&
            // Additional conditions that typically indicate NOT in PO Master yet
            sheet.pendingPoQty && 
            sheet.pendingPoQty > 0 &&
            sheet.approvedVendorName &&
            sheet.approvedVendorName.toString().trim() !== ''
        ).length;
    },
},

    {
        path: 'create-po',
        gateKey: 'createPo',
        name: 'Create PO',
        icon: <FilePlus2 size={20} />,
        element: <CreatePO />,
        notifications: () => 0,
    },

   {
    path: 'po-history',
    gateKey: 'ordersView',
    name: 'PO History',
    icon: <Package2 size={20} />,
    element: <Order /> , // Changed from <Order /> to <POHistory />
    notifications: (sheets: any[]) => {
        if (!Array.isArray(sheets) || sheets.length === 0) {
            return 0;
        }
        
        try {
            // Filter sheets with valid PO numbers
            const sheetsWithPoNumbers = sheets.filter((sheet: any) => 
                sheet?.poNumber && 
                sheet?.poNumber.toString().trim() !== ''
            );
            
            if (sheetsWithPoNumbers.length === 0) {
                return 0;
            }
            
            // Create a Map to store unique PO numbers
            const uniquePOMap = new Map<string, any>();
            
            // Add only unique PO numbers to the Map
            sheetsWithPoNumbers.forEach((sheet: any) => {
                const poNumber = sheet?.poNumber.toString().trim();
                if (poNumber && !uniquePOMap.has(poNumber)) {
                    uniquePOMap.set(poNumber, sheet);
                }
            });
            
            // Return count of unique PO numbers
            return uniquePOMap.size;
        } catch (error) {
            console.error('Error calculating PO notifications:', error);
            return 0;
        }
    },
},


   {
    path: 'get-lift',
    gateKey: 'ordersView',
    name: 'Lifting',
    icon: <Package2 size={20} />,
    element: <GetLift />,
    notifications: (sheets: any[]) =>
        sheets.filter(
            (sheet: any) =>
                sheet.liftingStatus === 'Pending' &&
                sheet.planned5 &&
                sheet.planned5.toString().trim() !== '' &&
                (!sheet.actual5 || sheet.actual5.toString().trim() === '')
        ).length,
},


   {
    path: 'store-in',
    gateKey: 'storeIn',
    name: 'Store In',
    icon: <Truck size={20} />,
    element: <StoreIn />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.planned6 !== '' && 
            sheet.actual6 === ''
        ).length,
},

 {
    path: 'Full-Kiting',
    gateKey: 'fullKiting', // ✅ ADD THIS
    name: 'Freight Payment',
    icon: <FilePlus2 size={20} />,
    element: <FullKiting />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.planned && 
            sheet.planned.toString().trim() !== '' && 
            (!sheet.actual || sheet.actual.toString().trim() === '')
        ).length,
},
{
    path: 'Payment-Status',
    name: 'HOD Approval',
    icon: <RotateCcw size={20} />,
    element: <PaymentStatus />,
    gateKey: 'paymentStatus',
    notifications: (sheetsData: any[]) => {
        try {
            // ✅ IMPORTANT: Expect [poMasterSheet, paymentsSheet, user] from Sidebar
            const [poMasterSheet = [], paymentsSheet = []] = sheetsData;
            
            if (!Array.isArray(poMasterSheet) || poMasterSheet.length === 0) {
                return 0;
            }

            // ✅ Get the current user's firm from context (you'll need to pass this)
            // For now, we'll assume we need to count all firms or filter by user.firmNameMatch
            // Since we can't access user here, we'll remove firm filtering
            
            // ✅ FILTER 1: Get PO numbers that already have payments
            const paidPONumbers = new Set(
                (paymentsSheet || []).map((payment: any) => payment.poNumber)
            );

            // ✅ FILTER 2: Only PENDING status and NOT already paid
            const pendingItems = poMasterSheet.filter((record: any) => {
                const poNumber = record?.poNumber || '';
                const status = (record?.status || '').toString().trim().toLowerCase();
                
                // Check if NOT paid yet AND status is pending/empty
                const notPaid = !paidPONumbers.has(poNumber);
                const isPending = status === 'pending' || status === '' || status === undefined;
                
                return notPaid && isPending;
            });

            // ✅ FILTER 3: Remove duplicate PO numbers (same as your page logic)
            const uniquePOMap = new Map();
            pendingItems.forEach(item => {
                const poNumber = item?.poNumber || '';
                if (poNumber && !uniquePOMap.has(poNumber)) {
                    uniquePOMap.set(poNumber, item);
                }
            });

            return uniquePOMap.size;
            
        } catch (error) {
            console.error('Error calculating Payment-Status notifications:', error);
            return 0;
        }
    }
},   


  // Then update the notification function:
{
    path: 'Make-Payment',
    gateKey: 'makePayment',
    name: 'Make Payment',
    icon: <FilePlus2 size={20} />,
    element: <MakePayment />,
    notifications: (sheets: any[]) => {
        // ✅ SIMPLIFIED: Since we're only passing paymentsSheet now
        const paymentsData = Array.isArray(sheets[0]) ? sheets[0] : [];
        
        if (paymentsData.length === 0) {
            console.log('⚠️ No payments data available');
            return 0;
        }
        
        console.log('📊 Total payments records:', paymentsData.length);
        
        // ✅ Count from Payments sheet: Planned has value BUT Actual is empty
        const pendingCount = paymentsData.filter((payment: any) => {
            const planned = String(payment?.planned || '').trim();
            const actual = String(payment?.actual || '').trim();
            
            const hasPlanned = planned !== '';
            const noActual = actual === '';
            
            const shouldCount = hasPlanned && noActual;
            
            // Debug logging
            if (payment?.uniqueNo) {
                console.log(`🔍 ${payment.uniqueNo}:`, {
                    planned,
                    actual,
                    hasPlanned,
                    noActual,
                    shouldCount
                });
            }
            
            return shouldCount;
        }).length;
        
        console.log('✅ Pending payments count:', pendingCount);
        return pendingCount;
    },
},


    {
    path: 'Quality-Check-In-Received-Item',
    gateKey: 'insteadOfQualityCheckInReceivedItem',
    name: 'Reject For GRN',
    icon: <Users size={20} />,
    element: <QuantityCheckInReceiveItem />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.planned7 && 
            sheet.planned7.toString().trim() !== '' && 
            (!sheet.actual7 || sheet.actual7.toString().trim() === '')
        ).length,
},


    // {
    //     path: 'Exchange-Materials',
    //     gateKey: 'exchangeMaterials',
    //     name: 'Exchange Materials',
    //     icon: <PackageCheck  size={20} />,
    //     element: <ExchangeMaterials />,
    //     notifications: () => 0,
    // },

    // {
    //     path: 'Return-Material-To-Party',
    //     gateKey: 'returnMaterialToParty',
    //     name: 'Return Material To Party',
    //     icon: <Users size={20} />,
    //     element: <ReturnMaterialToParty />,
    //     notifications: () => 0,
    // },

    {
    path: 'Send-Debit-Note',
    gateKey: 'sendDebitNote',
    name: 'Send Debit Note',
    icon: <FilePlus2 size={20} />,
    element: <SendDebitNote />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.planned9 && 
            sheet.planned9.toString().trim() !== '' && 
            (!sheet.actual9 || sheet.actual9.toString().trim() === '')
        ).length,
},

    {
    path: 'audit-data',
    gateKey: 'auditData',
    name: 'Audit Data',
    icon: <Users size={20} />,
    element: <AuditData />,
    notifications: (sheets: any[]) =>
        sheets.filter((sheet: any) => 
            sheet.planned1 && 
            sheet.planned1.toString().trim() !== '' && 
            (!sheet.actual1 || sheet.actual1.toString().trim() === '')
        ).length,
},

// {
//     path: 'rectify-the-mistake',
//     gateKey: 'rectifyTheMistake',
//     name: 'Rectify the mistake',
//     icon: <Users size={20} />,
//     element: <RectifyTheMistake />,
//     notifications: (sheets: any[]) => {
//         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;
        
//         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;
        
//         let count = 0;
//         sheetData.forEach((item: any) => {
//             const planned2 = item['Planned 2'] || item['planned2'];
//             const actual2 = item['Actual 2'] || item['actual2'];
            
//             const hasPlanned2 = planned2 && planned2.toString().trim() !== '';
//             const noActual2 = !actual2 || actual2.toString().trim() === '';
            
//             if (hasPlanned2 && noActual2) {
//                 count++;
//             }
//         });
        
//         return count;
//     },
// },

// {
//     path: 'reaudit-data',
//     gateKey: 'reauditData',
//     name: 'Reaudit Data',
//     icon: <Users size={20} />,
//     element: <ReauditData />,
//     notifications: (sheets: any[]) => {
//         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;
        
//         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;
        
//         let count = 0;
//         sheetData.forEach((item: any) => {
//             const planned3 = item['Planned 3'] || item['planned3'];
//             const actual3 = item['Actual 3'] || item['actual3'];
            
//             const hasPlanned3 = planned3 && planned3.toString().trim() !== '';
//             const noActual3 = !actual3 || actual3.toString().trim() === '';
            
//             if (hasPlanned3 && noActual3) {
//                 count++;
//             }
//         });
        
//         return count;
//     },
// },


//     {
//     path: 'take-entry-by-tally',
//     gateKey: 'takeEntryByTelly',
//     name: 'Take Entry By Tally',
//     icon: <ClipboardList size={20} />,
//     element: <TakeEntryByTally />,
//     notifications: (sheets: any[]) => {
//         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;
        
//         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;
        
//         let count = 0;
//         sheetData.forEach((item: any) => {
//             const planned4 = item['Planned 4'] || item['planned4'];
//             const actual4 = item['Actual 4'] || item['actual4'];
            
//             const hasPlanned4 = planned4 && planned4.toString().trim() !== '';
//             const noActual4 = !actual4 || actual4.toString().trim() === '';
            
//             if (hasPlanned4 && noActual4) {
//                 count++;
//             }
//         });
        
//         return count;
//     },
// },

//   {
//     path: 'AgainAuditing',
//     gateKey: 'againAuditing',
//     name: 'Again Auditing',
//     icon: <UserCheck size={20} />,
//     element: <AgainAuditing />,
//     notifications: (sheets: any[]) => {
//         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;
        
//         // The sheet data is passed as the first item in the array
//         const sheetData = sheets[0];
//         if (!Array.isArray(sheetData)) return 0;
        
//         console.log('🔍 Again Auditing - Sheet data count:', sheetData.length);
        
//         let count = 0;
//         sheetData.forEach((item: any) => {
//             const planned5 = item['Planned 5'] || item['planned5'];
//             const actual5 = item['Actual 5'] || item['actual5'];
            
//             const hasPlanned5 = planned5 && planned5.toString().trim() !== '';
//             const noActual5 = !actual5 || actual5.toString().trim() === '';
            
//             if (hasPlanned5 && noActual5) {
//                 count++;
//             }
//         });
        
//         console.log('📈 Again Auditing - Final count:', count);
//         return count;
//     },
// },
    // {
    //     path: 'store-out-approval',
    //     gateKey: 'storeOutApprovalView',
    //     name: 'Store Out Approval',
    //     icon: <PackageCheck size={20} />,
    //     element: <StoreOutApproval />,
    //     notifications: (sheets: any[]) =>
    //         sheets.filter(
    //             (sheet: any) =>
    //                 sheet.planned6 !== '' &&
    //                 sheet.actual6 === '' &&
    //                 sheet.indentType === 'Store Out'
    //         ).length,
    // },
    {
    path: 'Bill-Not-Received',
    gateKey: 'billNotReceived',
    name: 'Bill Not Received',
    icon: <ClipboardList size={20} />,
    element: <BillNotReceived />,
    notifications: (sheets: any[]) => {
        // Count items where planned11 is set but actual11 is not
        return sheets.filter((sheet: any) => {
            const hasPlanned11 = sheet.planned11 && sheet.planned11.toString().trim() !== '';
            const noActual11 = !sheet.actual11 || sheet.actual11.toString().trim() === '';
            
            return hasPlanned11 && noActual11;
        }).length;
    },
},

    {
        path: 'DBforPc',
        gateKey: 'dbForPc',
        name: 'DB For PC',
        icon: <PackageCheck  size={20} />,
        element: <DBforPc />,
        notifications: () => 0,
    },
    {
        path: 'administration',
        gateKey: 'administrate',
        name: 'Adminstration',
        icon: <ShieldUser size={20} />,
        element: <Administration />,
        notifications: () => 0,
    },
{
        path:'training-video',
        name:'Training Video',
        icon:<VideoIcon size={20}/>,
        element:<TrainnigVideo/>,
        notifications: () => 0,
    },
    {
        path:'license',
        name:'License',
        icon:<KeyRound size={20}/>,
        element:<Liecense/>,
        notifications: () => 0,

    },

];

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <SheetsProvider>
                                        <App routes={routes} />
                                    </SheetsProvider>
                                </ProtectedRoute>
                            }
                        >
                            {routes.map(({ path, element, gateKey }) => (
                                <Route
                                    key={path}
                                    path={path}
                                    element={
                                        <GatedRoute identifier={gateKey}>
                                            {element}
                                        </GatedRoute>
                                    }
                                />
                            ))}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </StrictMode>
    );
}