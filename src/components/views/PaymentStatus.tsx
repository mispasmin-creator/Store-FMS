import { Package2, FileText, Building, DollarSign, Calendar, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadFile, postToSheet } from '@/lib/fetchers';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

// ✅ UPDATED INTERFACE
interface PIPendingData {
    rowIndex: number;
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: string | number;
    firmNameMatch: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    pdf?: string;
}

interface POMasterRecord {
    rowIndex?: number;
    timestamp?: string;
    partyName?: string;
    poNumber?: string;
    internalCode?: string;
    product?: string;
    description?: string;
    quantity?: string | number;
    unit?: string;
    rate?: string | number;
    gstPercent?: string | number;
    discountPercent?: string | number;
    amount?: string | number;
    totalPoAmount?: string | number;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    firmNameMatch?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    pdf?: string;
}

export default function PIApprovals() {
    const { poMasterLoading, poMasterSheet, paymentsSheet, updateAll } = useSheets();
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<PIPendingData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PIPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    
    const [stats, setStats] = useState({
        total: 0,
        totalAmount: 0,
        pendingCount: 0
    });

    useEffect(() => {
        try {
            const safePoMasterSheet: POMasterRecord[] = Array.isArray(poMasterSheet) ? poMasterSheet : [];
            const safePaymentsSheet = Array.isArray(paymentsSheet) ? paymentsSheet : [];
            
            // ✅ FILTER 1: By firm
            const filteredByFirm = safePoMasterSheet.filter((sheet: POMasterRecord) =>
                user?.firmNameMatch?.toLowerCase() === "all" ||
                sheet?.firmNameMatch === user?.firmNameMatch
            );

            // ✅ FILTER 2: Get POs already in Payments sheet
            const paidPONumbers = new Set(
                safePaymentsSheet.map(payment => payment.poNumber)
            );

            // ✅ FILTER 3: Only PENDING status and not paid yet
            const pendingItems = filteredByFirm
                .filter((sheet: POMasterRecord) => {
                    const poNumber = sheet?.poNumber || '';
                    const status = sheet?.status?.toLowerCase() || '';
                    
                    return !paidPONumbers.has(poNumber) && 
                          (status === 'pending' || status === '' || status === undefined);
                })
                .map((sheet: POMasterRecord) => ({
                    rowIndex: sheet?.rowIndex || 0,
                    timestamp: sheet?.timestamp || '',
                    partyName: sheet?.partyName || '',
                    poNumber: sheet?.poNumber || '',
                    internalCode: sheet?.internalCode || '',
                    product: sheet?.product || '',
                    description: sheet?.description || '',
                    quantity: Number(sheet?.quantity || 0),
                    unit: sheet?.unit || '',
                    rate: Number(sheet?.rate || 0),
                    gstPercent: Number(sheet?.gstPercent || 0),
                    discountPercent: Number(sheet?.discountPercent || 0),
                    amount: Number(sheet?.amount || 0),
                    totalPoAmount: Number(sheet?.totalPoAmount || 0),
                    deliveryDate: sheet?.deliveryDate || '',
                    paymentTerms: sheet?.paymentTerms || '',
                    numberOfDays: Number(sheet?.numberOfDays || 0),
                    firmNameMatch: sheet?.firmNameMatch || '',
                    totalPaidAmount: Number(sheet?.totalPaidAmount || 0),
                    outstandingAmount: Number(sheet?.outstandingAmount || 0),
                    status: sheet?.status || 'Pending',
                    pdf: sheet?.pdf || '',
                }));

            // ✅ FILTER 4: Remove duplicates
            const uniquePOMap = new Map<string, PIPendingData>();
            pendingItems.forEach(item => {
                if (!uniquePOMap.has(item.poNumber)) {
                    uniquePOMap.set(item.poNumber, item);
                }
            });

            const pending = Array.from(uniquePOMap.values());
            setPendingData(pending);
            
            const totalAmount = pending.reduce((sum, item) => sum + item.totalPoAmount, 0);
            setStats({
                total: pending.length,
                totalAmount,
                pendingCount: pending.length
            });

        } catch (error) {
            console.error('❌ Error in PI Approvals useEffect:', error);
            setPendingData([]);
        }
    }, [poMasterSheet, paymentsSheet, user?.firmNameMatch]);

    const pendingColumns: ColumnDef<PIPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: Row<PIPendingData> }) => (
                <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                        setSelectedItem(row.original);
                        setOpenDialog(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                >
                    <FileText className="mr-2 h-3 w-3" />
                    Against PI
                </Button>
            ),
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <span className="font-medium text-purple-700">{row.original.poNumber || '-'}</span>
            )
        },
        {
            accessorKey: 'partyName',
            header: 'Party Name',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.partyName || '-'}</span>
            )
        },
        {
            accessorKey: 'internalCode',
            header: 'Indent No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.internalCode || '-'}
                </div>
            )
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.product || '-'}</span>
            )
        },
        {
            accessorKey: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ row }) => (
                <span className="font-bold text-purple-600">₹{row.original.totalPoAmount?.toLocaleString('en-IN')}</span>
            )
        },
        {
            accessorKey: 'totalPaidAmount',
            header: 'Total Paid',
            cell: ({ row }) => (
                <span className="font-semibold text-green-600">
                    ₹{row.original.totalPaidAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'outstandingAmount',
            header: 'Outstanding',
            cell: ({ row }) => (
                <span className="font-semibold text-red-600">
                    ₹{row.original.outstandingAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPending = status === 'pending';
                const isComplete = status === 'complete' || status === 'completed';
                
                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        isComplete 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : isPending 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                    }`}>
                        {isComplete && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {row.original.status || 'Pending'}
                    </span>
                );
            }
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.paymentTerms || '-'}</span>
            )
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ row }) => {
                const deliveryDate = row.original.deliveryDate;
                if (!deliveryDate) return <span className="text-sm">-</span>;
                
                try {
                    const date = new Date(deliveryDate);
                    if (isNaN(date.getTime())) {
                        return <span className="text-sm">{deliveryDate}</span>;
                    }
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                    return <span className="text-sm">{formattedDate}</span>;
                } catch (error) {
                    return <span className="text-sm">{deliveryDate}</span>;
                }
            }
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm',
            cell: ({ row }) => (
                <div className="flex items-center gap-1 text-gray-700">
                    <Building className="h-3 w-3 text-gray-500" />
                    {row.original.firmNameMatch || '-'}
                </div>
            )
        },
    ];

    // ✅ UPDATED SCHEMA - Only Pay Amount, File, Remarks
    const schema = z.object({
        payAmount: z.string().min(1, 'Pay Amount is required').refine(val => !isNaN(Number(val)), {
            message: 'Pay Amount must be a valid number'
        }),
        file: z.string().optional(),
        remark: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            payAmount: '',
            file: '',
            remark: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset();
        }
    }, [openDialog, form]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only PDF, JPG, and PNG files are allowed');
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File size must be less than 10MB');
            return;
        }

        try {
            setUploadingFile(true);
            const driveLink = await uploadFile({
                file: file,
                folderId: import.meta.env.VITE_BILL_PHOTO_FOLDER
            });
            
            form.setValue('file', driveLink);
            toast.success('File uploaded successfully to Google Drive');
        } catch (error) {
            toast.error('Failed to upload file to Google Drive');
            console.error('Upload error:', error);
        } finally {
            setUploadingFile(false);
        }
    };

    // ✅ Generate Unique Number for PAYMENTS sheet
    function generateUniqueNo(): string {
        const existingCount = Array.isArray(paymentsSheet) ? paymentsSheet.length : 0;
        return `PAY-${(existingCount + 1).toString().padStart(4, '0')}`;
    }

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedItem) {
                toast.error('No item selected');
                return;
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

            const uniqueNo = generateUniqueNo();
            const payAmount = Number(values.payAmount) || 0;
            const newTotalPaid = (selectedItem.totalPaidAmount || 0) + payAmount;
            const newOutstanding = (selectedItem.outstandingAmount || 0) - payAmount;
            const newStatus = newOutstanding <= 0 ? 'Complete' : 'Pending';

            // ✅ Prepare data for PAYMENTS sheet
            const paymentData = {
                timestamp: currentDateTime,
                uniqueNo: uniqueNo,
                partyName: selectedItem.partyName,
                poNumber: selectedItem.poNumber,
                totalPoAmount: selectedItem.totalPoAmount,
                internalCode: selectedItem.internalCode,
                product: selectedItem.product,
                deliveryDate: selectedItem.deliveryDate,
                paymentTerms: selectedItem.paymentTerms,
                numberOfDays: Number(selectedItem.numberOfDays || 0),
                pdf: selectedItem.pdf || '',
                payAmount: payAmount,
                file: values.file || '',
                remark: values.remark,
                totalPaidAmount: newTotalPaid,
                outstandingAmount: newOutstanding,
                status: '',
                planned: '',
                actual: '',
                delay: '',
                
            };

            // ✅ Post to PAYMENTS sheet
            await postToSheet(
                [paymentData],
                'insert',
                'Payments'
            );

            // ✅ Update PO MASTER sheet status and amounts
            // const updatePoData = {
            //     rowIndex: selectedItem.rowIndex,
            //     totalPaidAmount: newTotalPaid,
            //     outstandingAmount: newOutstanding,
            //     status: newStatus,
            // };

            // await postToSheet(
            //     [updatePoData],
            //     'update',
            //     'PO MASTER'
            // );

            toast.success(`Payment submitted for PO: ${selectedItem.poNumber}`);
            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch (error) {
            toast.error('Failed to process payment');
            console.error('Payment error:', error);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields correctly');
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-600 rounded-lg shadow">
                            <Package2 size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">PI Payments</h1>
                            <p className="text-gray-600">Process payments for pending purchase orders</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-purple-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total PO Amount</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Payment Status</p>
                                        <p className="text-2xl font-bold text-amber-600 mt-1">
                                            {stats.pendingCount > 0 ? 'Pending' : 'Completed'}
                                        </p>
                                    </div>
                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full ${
                                        stats.pendingCount > 0 ? 'bg-amber-100' : 'bg-green-100'
                                    }`}>
                                        {stats.pendingCount > 0 ? (
                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                        ) : (
                                            <CheckCircle className="h-6 w-6 text-green-600" />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Main Content Card */}
                <Card className="bg-white shadow-lg border-0 mb-6">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Pending Payments</CardTitle>
                                <p className="text-gray-600 text-sm mt-1">Click "Make Payment" to process payment for purchase order</p>
                            </div>
                            {stats.total === 0 ? (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    All Paid
                                </div>
                            ) : (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-300">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {stats.total} Pending
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {pendingData.length > 0 ? (
                            <DataTable
                                data={pendingData}
                                columns={pendingColumns}
                                searchFields={['poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                dataLoading={poMasterLoading}
                                className="border rounded-lg"
                            />
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Payments</h3>
                                <p className="text-gray-500">All payments have been processed or no POs with pending status.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payment Dialog */}
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    {selectedItem && (
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <DollarSign className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-xl">Make Payment</DialogTitle>
                                                <DialogDescription>
                                                    Process payment for PO: <span className="font-semibold text-purple-600">{selectedItem.poNumber}</span>
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <Separator />

                                    {/* PO Details Card */}
                                    <Card className="bg-purple-50 border-purple-200">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold text-purple-800 flex items-center gap-2">
                                                <Package2 className="h-4 w-4" />
                                                PO Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">PO Number</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.poNumber}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Party Name</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.partyName}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Indent No.</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.internalCode}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Product</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.product}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total PO Amount</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPoAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total Paid</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPaidAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Outstanding</p>
                                                    <p className="text-sm font-semibold text-red-600">
                                                        ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Status</p>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        {selectedItem.status || 'Pending'}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ✅ UPDATED Form Fields - Only Pay Amount, File, Remarks */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="payAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium flex items-center gap-2">
                                                        <DollarSign className="h-4 w-4" />
                                                        Pay Amount *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Enter payment amount"
                                                            className="border-gray-300 focus:border-purple-500"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="remark"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium">Remarks *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="text"
                                                            placeholder="Enter payment remarks"
                                                            className="border-gray-300 focus:border-purple-500"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="file"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium flex items-center gap-2">
                                                        <Upload className="h-4 w-4" />
                                                        Upload Payment Proof
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="space-y-2">
                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                    onChange={handleFileUpload}
                                                                    disabled={uploadingFile}
                                                                    className="border-0 cursor-pointer"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    Upload payment proof (PDF, JPG, PNG - Max 10MB)
                                                                </p>
                                                            </div>
                                                            {uploadingFile && (
                                                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                                                    <Loader size={16} color="blue" />
                                                                    Uploading to Google Drive...
                                                                </div>
                                                            )}
                                                            {field.value && !uploadingFile && (
                                                                <div className="space-y-1">
                                                                    <p className="text-sm text-green-600 flex items-center gap-2">
                                                                        <CheckCircle className="h-4 w-4" />
                                                                        File uploaded successfully
                                                                    </p>
                                                                    <a 
                                                                        href={field.value} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                                                    >
                                                                        View uploaded file →
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button 
                                                variant="outline" 
                                                type="button"
                                                className="border-gray-300"
                                                disabled={form.formState.isSubmitting || uploadingFile}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button 
                                            type="submit" 
                                            className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                                            disabled={form.formState.isSubmitting || uploadingFile}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <>
                                                    <Loader size={18} className="mr-2" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    Submit Payment
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    )}
                </Dialog>
            </div>
        </div>
    );
}