import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { postToSheet, uploadFile } from '@/lib/fetchers';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';

interface GetPurchaseData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
    plannedDate?: string;
}
interface HistoryData {
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    product?: string;
    photoOfBill?: string;
    quantity?: number;
    pendingLiftQty?: number;
    receivedQty?: number;
    pendingPoQty?: number;
}

interface IndentSheetRecord {
    rowIndex?: string; // ✅ ADD THIS
    liftingStatus?: string;
    firmNameMatch?: string;
    indentNumber?: string;
    approvedVendorName?: string;
    poNumber?: string;
    actual4?: string | number | Date;
    actual5?: string | number | Date; // <-- Added to fix compile error
    planned5?: string | number | Date;
    deliveryDate?: string | number | Date;
    productName?: string;
    pendingLiftQty?: string | number;
    pendingQty?: string | number; // ADD THIS LINE
    quantity?: string | number;
    approvedQuantity?: string | number;
    cancelOty?: string | number; // ✅ ADD THIS - matches the header field name
    totalQty?: string | number; // <-- Added to fix compile error
}
interface StoreInRecord {
    indentNo?: string;
    firmNameMatch?: string;
    vendorName?: string;
    qty?: string | number;
    receivedQuantity?: string | number;
}

interface AuthUser {
    firmNameMatch?: string;
    receiveItemAction?: boolean;
}

export default function GetPurchase() {
    const { indentSheet, indentLoading, updateStoreInSheet, storeInSheet } = useSheets();
    const { user } = useAuth() as { user: AuthUser };
    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [vendorOptions, setVendorOptions] = useState<string[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showCancelQty, setShowCancelQty] = useState(false);
    const [cancelQtyValue, setCancelQtyValue] = useState('');

    // Fetch vendor options from MASTER sheet
    useEffect(() => {
        const fetchVendorOptions = async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_APP_SCRIPT_URL}?sheetName=MASTER`
                );
                const data = await response.json();
                if (data.success && data.options) {
                    setVendorOptions(data.options.vendorName || []);
                }
            } catch (error) {
                console.error('Failed to fetch vendor options:', error);
                toast.error('Failed to load vendor options');
            }
        };
        
        fetchVendorOptions();
    }, []);

    useEffect(() => {
    const filteredByFirm = indentSheet.filter((sheet: IndentSheetRecord) =>
        user?.firmNameMatch?.toLowerCase() === "all" || sheet.firmNameMatch === user?.firmNameMatch
    );

    setTableData(
        filteredByFirm
            .filter((sheet: IndentSheetRecord) => {
                // Show only Pending items with planned date but no actual date
                const hasPlanned5 = sheet.planned5 && sheet.planned5.toString().trim() !== '';
                const hasActual5 = sheet.actual5 && sheet.actual5.toString().trim() !== '';
                const isPending = sheet.liftingStatus === 'Pending';
                
                return isPending && hasPlanned5 && !hasActual5;
            })
            .map((sheet: IndentSheetRecord) => {
                // Calculate received quantity from STORE IN sheet
                const receivedQty = storeInSheet
                    .filter((store: StoreInRecord) => store.indentNo === sheet.indentNumber?.toString())
                    .reduce((sum: number, store: StoreInRecord) => sum + (Number(store.receivedQuantity) || 0), 0);
                
                // Use pendingPoQty from sheet if available, otherwise calculate
                const pendingPoQty = Number(sheet.pendingQty) || 
                                    (Number(sheet.totalQty) || Number(sheet.quantity) || 0) - receivedQty;
                
                return {
                    indentNo: sheet.indentNumber?.toString() || '',
                    firmNameMatch: sheet.firmNameMatch || '',
                    vendorName: sheet.approvedVendorName || '',
                    poNumber: sheet.poNumber || '',
                    poDate: sheet.actual4 ? formatDate(new Date(sheet.actual4)) : '',
                    deliveryDate: sheet.deliveryDate ? formatDate(new Date(sheet.deliveryDate)) : '',
                    plannedDate: sheet.planned5 ? formatDate(new Date(sheet.planned5)) : 'Not Set',
                    product: sheet.productName || '',
                    quantity: Number(sheet.totalQty) || Number(sheet.quantity) || 0,
                    pendingLiftQty: pendingPoQty,
                    receivedQty: receivedQty,
                    pendingPoQty: pendingPoQty,
                };
            })
    );
}, [indentSheet, user?.firmNameMatch]);


    useEffect(() => {
        const filteredByFirm = indentSheet.filter((sheet: IndentSheetRecord) =>
            user?.firmNameMatch?.toLowerCase() === "all" || sheet.firmNameMatch === user?.firmNameMatch
        );

        const completedIndents = filteredByFirm
            .filter((sheet: IndentSheetRecord) => {
                return sheet.liftingStatus === 'Complete' && 
                       sheet.planned5 && 
                       sheet.planned5.toString().trim() !== '';
            });

        interface SheetData {
            indentNumber?: string | number;
            poNumber?: string;
            actual4?: string | Date;
            deliveryDate?: string | Date | null;
            approvedVendorName?: string;
            productName?: string;
            approvedQuantity?: number;
            quantity?: number;
            pendingLiftQty?: number;
            firmNameMatch?: string;
        }

        const indentDataMap = new Map(
            completedIndents.map((sheet: SheetData) => [
                sheet.indentNumber?.toString() || '',
                {
                    poNumber: sheet.poNumber || '',
                    poDate: sheet.actual4 ? formatDate(new Date(sheet.actual4)) : '',
                    deliveryDate: sheet.deliveryDate ? formatDate(new Date(sheet.deliveryDate)) : '',
                    approvedVendorName: sheet.approvedVendorName || '',
                    productName: sheet.productName || '',
                    approvedQuantity: sheet.approvedQuantity || sheet.quantity || 0,
                    pendingLiftQty: sheet.pendingLiftQty || 0,
                    firmNameMatch: sheet.firmNameMatch || '',
                }
            ])
        );

        const filteredStoreIn = storeInSheet.filter((sheet: StoreInRecord) => 
            user?.firmNameMatch?.toLowerCase() === "all" || 
            sheet.firmNameMatch === user?.firmNameMatch
        );

        setHistoryData(
            filteredStoreIn
                .filter((sheet: StoreInRecord) => indentDataMap.has(sheet.indentNo || ''))
                .map((sheet: StoreInRecord) => {
                    const indentData = indentDataMap.get(sheet.indentNo || '')!;
                    
                    const indentRecord = completedIndents.find(
                        (indent) => indent.indentNumber?.toString() === sheet.indentNo
                    );
                    
                    const approvedQty = Number(indentRecord?.approvedQuantity) || 
                                       Number(indentRecord?.quantity) || 0;
                    
                    const receivedQty = filteredStoreIn
                        .filter((store: StoreInRecord) => store.indentNo === sheet.indentNo)
                        .reduce((sum: number, store: StoreInRecord) => 
                            sum + (Number(store.receivedQuantity) || 0), 0);
                    
                    const pendingLift = approvedQty - receivedQty;
                    
                    return {
                        indentNo: sheet.indentNo || '',
                        firmNameMatch: indentData.firmNameMatch || sheet.firmNameMatch || '',
                        vendorName: indentData.approvedVendorName || sheet.vendorName || '',
                        poNumber: indentData.poNumber,
                        poDate: indentData.poDate,
                        deliveryDate: indentData.deliveryDate,
                        product: indentData.productName,
                        quantity: approvedQty,
                        pendingLiftQty: pendingLift,
                        receivedQty: receivedQty,
                        pendingPoQty: Math.max(0, pendingLift),
                        photoOfBill: (sheet as any).photoOfBill || '',
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [storeInSheet, indentSheet, user?.firmNameMatch]);

    // Creating table columns
    const columns: ColumnDef<GetPurchaseData>[] = [
        ...(user?.receiveItemAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GetPurchaseData> }) => {
                        const indent = row.original;
                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                            setShowCancelQty(false);
                                            setCancelQtyValue('');
                                        }}
                                    >
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
         {
        accessorKey: 'plannedDate', // ✅ ADD THIS COLUMN
        header: 'Planned Date',
        cell: ({ getValue }) => {
            const plannedDate = getValue() as string;
            return (
                <div className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}>
                    {plannedDate}
                </div>
            );
        }
    },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Approved Vendor Name',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
          {
            accessorKey: 'photoOfBill',
            header: 'Photo Of Bill',
            cell: ({ getValue }) => {
                const photoUrl = getValue() as string;
                if (!photoUrl) return <div className="text-muted-foreground">-</div>;
                
                return (
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(photoUrl, '_blank')}
                        >
                            View Bill
                        </Button>
                    </div>
                );
            }
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => <div>{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'pendingLiftQty',
            header: 'Pending Lift Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
        {
            accessorKey: 'receivedQty',
            header: 'Received Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
        {
            accessorKey: 'pendingPoQty',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div>{getValue() as number || 0}</div>
        },
    ];

    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().min(1, 'Bill status is required'),
        billNo: z.string().optional(),
        qty: z.coerce.number().optional(),
        leadTime: z.string().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        discountAmount: z.coerce.number().optional(),
        paymentType: z.string().optional(),
        advanceAmount: z.coerce.number().optional(),
        photoOfBill: z.instanceof(File).optional()
        .refine((file) => {
            // Allow both images and PDFs
            if (!file) return true; // Optional field
            const allowedTypes = [
                'image/jpeg', 
                'image/jpg', 
                'image/png', 
                'image/gif', 
                'image/webp',
                'application/pdf'
            ];
            return allowedTypes.includes(file.type);
        }, 'File must be an image (JPEG, PNG, GIF, WebP) or PDF'),
        billRemark: z.string().optional(),
        vendorName: z.string().optional(),
        transportationInclude: z.string().optional(),
        transporterName: z.string().optional(),
        vehicleNo: z.string().optional(),
        driverName: z.string().optional(),
        driverMobileNo: z.string().optional(),
        amount: z.coerce.number().optional(),
        cancelPendingQty: z.coerce.number().optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any, // Add type assertion here
        defaultValues: {
            billStatus: '',
            billNo: '',
            qty: 0,
            leadTime: '',
            typeOfBill: '',
            billAmount: 0,
            discountAmount: 0,
            paymentType: '',
            advanceAmount: 0,
            billRemark: '',
            vendorName: '',
            transportationInclude: '',
            transporterName: '',
            vehicleNo: '',
            driverName: '',
            driverMobileNo: '',
            amount: 0,
            cancelPendingQty: 0,
        },
    });

    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    // Handle cancel quantity only submission
   // Handle cancel quantity only submission
// Handle cancel quantity only submission
// Handle cancel quantity only submission
// Handle cancel quantity only submission
const handleCancelQtySubmit = async () => {
    if (!cancelQtyValue || Number(cancelQtyValue) <= 0) {
        toast.error('Please enter a valid quantity to cancel');
        return;
    }

    const cancelQty = Number(cancelQtyValue);
    if (cancelQty > (selectedIndent?.pendingPoQty || 0)) {
        toast.error(`Cancel quantity cannot exceed pending PO quantity: ${selectedIndent?.pendingPoQty || 0}`);
        return;
    }

    try {
        console.log('❌ Processing cancel pending quantity only:', cancelQty);
        
        // ✅ Find the existing row for this indent number
        const existingRow = indentSheet.find((sheet: IndentSheetRecord) => 
            sheet.indentNumber?.toString() === selectedIndent?.indentNo
        );

        if (!existingRow) {
            toast.error('Could not find the indent record to update');
            return;
        }

        // ✅ Use the exact field name from headers: "cancelOty"
        const updateRecord = {
            rowIndex: existingRow.rowIndex,
            cancelOty: cancelQty, // ✅ Exact field name from headers
        };

        console.log('📤 Update record to submit (Cancel Qty only):', updateRecord);

        // ✅ Use 'update' operation instead of 'insert'
        const cancelResult = await postToSheet([updateRecord], 'update', 'INDENT');
        console.log('✅ Cancel quantity result:', cancelResult);

        toast.success(`Cancelled ${cancelQty} quantity for ${selectedIndent?.indentNo}`);
        setShowCancelQty(false);
        setCancelQtyValue('');
        
        setTimeout(() => {
            updateStoreInSheet();
            console.log('🔄 Data refreshed after cancel');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error in cancel quantity:', error);
        toast.error('Failed to cancel quantity. Please try again.');
    }
};

async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            console.log('🔄 Starting form submission...');
            console.log('📝 Selected indent:', selectedIndent);
            console.log('📋 Form values:', values);

            // Handle cancel pending quantity first (independent of bill status)
            // Handle cancel pending quantity first (independent of bill status)
// Handle cancel pending quantity first (independent of bill status)
// Handle cancel pending quantity first (independent of bill status)
// Handle cancel pending quantity first (independent of bill status)
if (values.cancelPendingQty && values.cancelPendingQty > 0) {
    console.log('❌ Processing cancel pending quantity:', values.cancelPendingQty);
    
    // ✅ Find the existing row for this indent number
    const existingRow = indentSheet.find((sheet: IndentSheetRecord) => 
        sheet.indentNumber?.toString() === selectedIndent?.indentNo
    );

    if (existingRow) {
        // ✅ Use the exact field name from headers: "cancelOty"
        const updateRecord = {
            rowIndex: existingRow.rowIndex,
            cancelOty: values.cancelPendingQty, // ✅ Exact field name from headers
        };

        console.log('📤 Update record to submit (Cancel Qty only):', updateRecord);

        // ✅ Use 'update' operation instead of 'insert'
        const cancelResult = await postToSheet([updateRecord], 'update', 'INDENT');
        console.log('✅ Cancel quantity result:', cancelResult);

        toast.success(`Cancelled ${values.cancelPendingQty} quantity for ${selectedIndent?.indentNo}`);
    } else {
        toast.error('Could not find the indent record to update');
    }
}            // Continue with original bill submission logic only if bill status is provided
         

        if (values.billStatus) {
                let photoUrl = '';
                // In the onSubmit function, update the file upload section:
                    if (values.photoOfBill) {
                        console.log('📤 Uploading file...');
                        console.log('📄 File type:', values.photoOfBill.type);
                        console.log('📄 File name:', values.photoOfBill.name);
                        
                        try {
                            photoUrl = await uploadFile({
                                file: values.photoOfBill,
                                folderId: import.meta.env.VITE_BILL_PHOTO_FOLDER || 'bill-photos'
                            });
                            console.log('✅ File uploaded:', photoUrl);
                            
                            // Show success message based on file type
                            if (values.photoOfBill.type === 'application/pdf') {
                                toast.success('PDF document uploaded successfully');
                            } else {
                                toast.success('Image uploaded successfully');
                            }
                        } catch (uploadError) {
                            console.error('❌ File upload error:', uploadError);
                            toast.error('Failed to upload file. Please try again.');
                            return;
                        }
                    }

                const currentDateTime = new Date()
                    .toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                    })
                    .replace(',', '');

                console.log('📅 Timestamp:', currentDateTime);

                const newStoreInRecord = {
                    timestamp: currentDateTime,
                    liftNumber: '',
                    indentNo: selectedIndent?.indentNo || '',
                    billNo: values.billNo || '',
                    vendorName: values.vendorName || selectedIndent?.vendorName || '',
                    productName: selectedIndent?.product || '',
                    qty: Number(values.qty) || Number(selectedIndent?.quantity) || 0,
                    leadTimeToLiftMaterial: Number(values.leadTime) || 0,
                    discountAmount: Number(values.discountAmount) || 0,
                    typeOfBill: values.typeOfBill || '',
                    billAmount: Number(values.billAmount) || 0,
                    paymentType: values.paymentType || '',
                    advanceAmountIfAny: Number(values.advanceAmount) || 0,
                    photoOfBill: photoUrl,
                    transportationInclude: values.transportationInclude || '',
                    transporterName: values.transporterName || '',
                    amount: Number(values.amount) || 0,
                    warrantyStatus: '',
                    endDateWarrenty: '',
                    planned6: '',
                    actual6: '',
                    timeDelay6: '',
                    sendDebitNote: '',
                    receivingStatus: '',
                    billStatus: values.billStatus || '',
                    receivedQuantity: 0,
                    photoOfProduct: '',
                    unitOfMeasurement: '',
                    damageOrder: '',
                    quantityAsPerBill: Number(values.qty) || 0,
                    priceAsPerPo: 0,
                    remark: '',
                    debitNoteCopy: '',
                    planned7: '',
                    actual7: '',
                    timeDelay7: '',
                    status: '',
                    reason: '',
                    billNumber: values.billNo || '',
                    planned8: '',
                    actual8: '',
                    delay8: '',
                    statusPurchaser: '',
                    planned9: '',
                    actual9: '',
                    timeDelay9: '',
                    billCopy: '',
                    returnCopy: '',
                    debitnotenumber: '',
                    planned10: '',
                    actual10: '',
                    timeDelay10: '',
                    warrenty: '',
                    billReceived: '',
                    billAmount2: '',
                    billImage: '',
                    exchangeQty: '',
                    billNumber2: '',
                    poDate: selectedIndent?.poDate || '',
                    poNumber: selectedIndent?.poNumber || '',
                    vendor: values.vendorName || selectedIndent?.vendorName || '',
                    indentNumber: selectedIndent?.indentNo || '',
                    product: selectedIndent?.product || '',
                    uom: '',
                    quantity: Number(values.qty) || Number(selectedIndent?.quantity) || 0,
                    poCopy: '',
                    planned11: '',
                    actual11: '',
                    billStatusNew: '',
                    materialStatus: '',
                    vehicleNo: values.vehicleNo || '',
                    driverName: values.driverName || '',
                    driverMobileNo: values.driverMobileNo || '',
                    billImageStatus: '',
                    billRemark: values.billRemark || '',
                    firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                };

                console.log('📤 Data to insert:', newStoreInRecord);

                const result = await postToSheet([newStoreInRecord], 'insert', 'STORE IN');
                console.log('✅ Insert result:', result);

                toast.success(`Created store record for ${selectedIndent?.indentNo}`);
            }

            setOpenDialog(false);
            form.reset();
            setShowCancelQty(false);
            setCancelQtyValue('');
            
            setTimeout(() => {
                updateStoreInSheet();
                console.log('🔄 Data refreshed after insert');
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error in onSubmit:', error);
            toast.error('Failed to process request. Please try again.');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Get Purchase"
                        subtext="Manage purchase bill details and status"
                        tabs
                    >
                        <ShoppingCart size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="max-w-2xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Purchase Details</DialogTitle>
                                    <DialogDescription>
                                        Update purchase details for{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted py-2 px-5 rounded-md">
                                    <div className="space-y-1">
                                        <p className="font-medium">Indent Number</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.indentNo}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Product</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.product || '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">PO Number</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.poNumber}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Pending Lift Qty</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.pendingLiftQty || 0}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Received Qty</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.receivedQty || 0}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Pending PO Qty</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.pendingPoQty || 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Cancel Pending PO Quantity Section */}
                                {!showCancelQty ? (
                                    <div className="flex justify-between items-center border rounded-lg p-4 bg-orange-50 border-orange-200">
    <div>
        <h3 className="font-medium text-orange-800">Cancel Pending PO Quantity</h3>
        <p className="text-sm text-orange-600 mt-1">
            Cancel quantity
        </p>
    </div>
    <Button
        type="button"
        variant="outline"
        className="border-orange-300 text-orange-700 hover:bg-orange-100"
        onClick={() => setShowCancelQty(true)}
    >
        Cancel Pending PO
    </Button>
</div>
                                ) : (
                                    <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-medium text-orange-800">Cancel Pending PO Quantity</h3>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCancelQty(false);
                                                    setCancelQtyValue('');
                                                }}
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div>
    <FormLabel className="text-orange-700">
        Quantity to Cancel (Max: {selectedIndent.pendingPoQty || 0})
    </FormLabel>
    <Input
        type="number"
        placeholder="Enter quantity to cancel"
        min="0"
        max={selectedIndent.pendingPoQty}
        value={cancelQtyValue}
        onChange={(e) => setCancelQtyValue(e.target.value)}
        className="border-orange-300 focus:border-orange-500"
    />
    {/* <p className="text-sm text-orange-600 mt-1">
        This will only update the "Cancel Oty" column in INDENT sheet. Max: {selectedIndent.pendingPoQty || 0}
    </p> */}
</div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-orange-300 text-orange-700 hover:bg-orange-100 h-10"
                                                onClick={handleCancelQtySubmit}
                                            >
                                                Submit Cancel Only
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Hidden cancel quantity field for form submission */}
                                <FormField
                                    control={form.control}
                                    name="cancelPendingQty"
                                    render={({ field }) => (
                                        <FormItem className="hidden">
                                            <FormControl>
                                                <Input type="hidden" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="billStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Status *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select bill status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Bill Received">
                                                            Bill Received
                                                        </SelectItem>
                                                        <SelectItem value="Bill Not Received">
                                                            Bill Not Received
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    {billStatus === 'Bill Received' && (
                                        <FormField
                                            control={form.control}
                                            name="billNo"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill No. *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter bill number"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    {billStatus && (
                                        <>
                                            {/* Replace the Qty field */}
                                                <FormField
                                                    control={form.control}
                                                    name="qty"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Qty</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Enter quantity"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                            <FormField
                                                control={form.control}
                                                name="leadTime"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Lead Time To Lift Material *
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter lead time"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="vendorName"
                                                render={({ field }) => {
                                                    const filteredVendors = vendorOptions.filter(vendor =>
                                                        vendor.toLowerCase().includes(vendorSearch.toLowerCase())
                                                    );
                                                    
                                                    return (
                                                        <FormItem>
                                                            <FormLabel>Vendor Name</FormLabel>
                                                            <Select
                                                                onValueChange={(value) => {
                                                                    field.onChange(value);
                                                                    setVendorSearch('');
                                                                }}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select vendor name" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent className="max-h-[300px]">
                                                                    <div className="sticky top-0 bg-white p-2 border-b z-10">
                                                                        <Input
                                                                            placeholder="Search vendor..."
                                                                            value={vendorSearch}
                                                                            onChange={(e) => setVendorSearch(e.target.value)}
                                                                            className="h-8"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    </div>
                                                                    {filteredVendors.length > 0 ? (
                                                                        filteredVendors.map((vendor) => (
                                                                            <SelectItem key={vendor} value={vendor}>
                                                                                {vendor}
                                                                            </SelectItem>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-sm text-gray-500 text-center py-2">
                                                                            No vendor found
                                                                        </div>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    );
                                                }}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="transportationInclude"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Transportation Include</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select transportation" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Yes">Yes</SelectItem>
                                                                <SelectItem value="No">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="transporterName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Transporter Name</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter transporter name"
                                                                {...field}
                                                                disabled={form.watch("transportationInclude") !== "Yes"}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="vehicleNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Vehicle No.</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter Vehicle No."
                                                                {...field}
                                                                disabled={form.watch("transportationInclude") !== "Yes"}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="driverName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Driver Name</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter Driver name"
                                                                {...field}
                                                                disabled={form.watch("transportationInclude") !== "Yes"}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="driverMobileNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Driver Mobile No.</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder="Enter Driver Mobile No."
                                                                {...field}
                                                                disabled={form.watch("transportationInclude") !== "Yes"}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                            control={form.control}
                                                            name="amount"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Amount</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            placeholder="Enter amount"
                                                                            {...field}
                                                                            disabled={form.watch("transportationInclude") !== "Yes"}
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />

                                            <FormField
                                                control={form.control}
                                                name="billRemark"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bill Remark</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter bill remark"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="typeOfBill"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type Of Bill *</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select type of bill" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="independent">
                                                                    Independent
                                                                </SelectItem>
                                                                <SelectItem value="common">
                                                                    Common
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {typeOfBill === 'independent' && (
                                                <>
                                                    <FormField
                                                            control={form.control}
                                                            name="billAmount"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Bill Amount</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            placeholder="Enter bill amount"
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />

                                                    <FormField
                                                    control={form.control}
                                                    name="discountAmount"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Discount Amount</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Enter discount amount"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                    <FormField
                                                        control={form.control}
                                                        name="paymentType"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Payment Type</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select payment type" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="Advance">
                                                                            Advance
                                                                        </SelectItem>
                                                                        <SelectItem value="Credit">
                                                                            Credit
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />

                                                   <FormField
                                                control={form.control}
                                                name="advanceAmount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Advance Amount If Any</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter advance amount"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="photoOfBill"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Photo/Bill Document *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="file"
                                                                accept="image/*,.pdf,application/pdf"
                                                                onChange={(e) => field.onChange(e.target.files?.[0])}
                                                            />
                                                        </FormControl>
                                                        {form.formState.errors.photoOfBill && (
                                                            <p className="text-sm text-red-500">
                                                                {form.formState.errors.photoOfBill.message}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground">
                                                            Upload image (JPEG, PNG, GIF, WebP) or PDF document
                                                        </p>
                                                    </FormItem>
                                                )}
                                            />
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
