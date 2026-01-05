import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState, useMemo } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { postToSheet } from '@/lib/fetchers';
import { Calculator, Search } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';

interface TallyEntryPendingData {
    indentNo: string;
    indentDate: string;
    purchaseDate: string;
    materialInDate: string;
    plannedDate: string;
    productName: string;
    billNo: string;
    qty: number;
    partyName: string;
    billAmt: number;
    billImage: string;
    billReceivedLater: string;
    notReceivedBillNo: string;
    location: string;
    typeOfBills: string;
    productImage: string;
    area: string;
    indentedFor: string;
    approvedPartyName: string;
    rate: number;
    indentQty: number;
    totalRate: number;
    status1: string;
    remarks1: string;
    status2: string;
    remarks2: string;
    status3: string;
    remarks3: string;
    firmNameMatch: string;
}

interface TallyEntryHistoryData {
    indentNo: string;
    indentDate: string;
    purchaseDate: string;
    materialInDate: string;
    productName: string;
    billNo: string;
    qty: number;
    partyName: string;
    billAmt: number;
    billImage: string;
    billReceivedLater: string;
    notReceivedBillNo: string;
    location: string;
    typeOfBills: string;
    productImage: string;
    area: string;
    indentedFor: string;
    approvedPartyName: string;
    rate: number;
    indentQty: number;
    totalRate: number;
    status1: string;
    remarks1: string;
    status2: string;
    remarks2: string;
    status3: string;
    remarks3: string;
    status4: string;
    remarks4: string;
    firmNameMatch: string;
}

// Helper function to get field value with multiple possible keys
const getFieldValue = (item: any, ...possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
            return item[key];
        }
    }
    return '';
};

// Helper function to format date to dd/mm/yy
const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) return dateString;
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = String(dateObj.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch {
        return dateString;
    }
};

export default function TallyEntry() {
    const { tallyEntrySheet, updateAll } = useSheets();
    const { user } = useAuth();

    const [pendingData, setPendingData] = useState<TallyEntryPendingData[]>([]);
    const [historyData, setHistoryData] = useState<TallyEntryHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<TallyEntryPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedPartyName, setSelectedPartyName] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        console.log('🔍 Raw tallyEntrySheet data:', tallyEntrySheet);
        if (tallyEntrySheet.length > 0) {
            console.log('📋 First item keys:', Object.keys(tallyEntrySheet[0]));
            console.log('📋 First item sample:', tallyEntrySheet[0]);
        }

        // Filter by firm name
        const filteredByFirm = tallyEntrySheet.filter(item => {
            const firmName = getFieldValue(item, 'Firm Name', 'firmName', 'firmNameMatch');
            return user.firmNameMatch.toLowerCase() === "all" || firmName === user.firmNameMatch;
        });
        
        console.log('✅ Filtered by firm:', filteredByFirm.length);

        setPendingData(
            filteredByFirm
                .filter((i) => {
                    const planned4 = getFieldValue(i, 'Planned 4', 'planned4');
                    const actual4 = getFieldValue(i, 'Actual 4', 'actual4');
                    return planned4 !== '' && actual4 === '';
                })
                .map((i) => {
                    const mapped = {
                        indentNo: getFieldValue(i, 'Indent Number', 'indentNumber', 'indentNo').toString().trim(),
                        firmNameMatch: getFieldValue(i, 'Firm Name', 'firmName', 'firmNameMatch').toString().trim(),
                        indentDate: getFieldValue(i, 'Indent Date', 'indentDate'),
                        purchaseDate: getFieldValue(i, 'Purchase Date', 'purchaseDate'),
                        materialInDate: getFieldValue(i, 'Material In Date', 'materialInDate'),
                        plannedDate: getFieldValue(i, 'Planned 4', 'planned4'),
                        productName: getFieldValue(i, 'Product Name', 'productName'),
                        billNo: getFieldValue(i, 'Bill No.', 'billNo').toString(),
                        qty: Number(getFieldValue(i, 'Qty', 'qty')) || 0,
                        partyName: getFieldValue(i, 'Party Name', 'partyName'),
                        billAmt: Number(getFieldValue(i, 'Bill Amt', 'billAmt')) || 0,
                        billImage: getFieldValue(i, 'Bill Image', 'billImage'),
                        billReceivedLater: getFieldValue(i, 'Bill Recieved later', 'billReceivedLater'),
                        notReceivedBillNo: getFieldValue(i, 'Not Received Bill No.', 'notReceivedBillNo'),
                        location: getFieldValue(i, 'Location', 'location'),
                        typeOfBills: getFieldValue(i, 'Type Of Bills', 'typeOfBills'),
                        productImage: getFieldValue(i, 'Prodcut Image', 'Product Image', 'productImage'),
                        area: getFieldValue(i, 'Area', 'area'),
                        indentedFor: getFieldValue(i, 'Indented For', 'indentedFor'),
                        approvedPartyName: getFieldValue(i, 'Approved Party Name', 'approvedPartyName'),
                        rate: Number(getFieldValue(i, 'Rate', 'rate')) || 0,
                        indentQty: Number(getFieldValue(i, 'Indent Qty', 'indentQty')) || 0,
                        totalRate: Number(getFieldValue(i, 'Total Rate', 'totalRate')) || 0,
                        status1: getFieldValue(i, 'Status 1', 'status1'),
                        remarks1: getFieldValue(i, 'Remarks1', 'remarks1'),
                        status2: getFieldValue(i, 'Status 2', 'status2'),
                        remarks2: getFieldValue(i, 'Remarks 2', 'remarks2'),
                        status3: getFieldValue(i, 'Status 3', 'status3'),
                        remarks3: getFieldValue(i, 'Remarks 3', 'remarks3'),
                    };
                    console.log('📝 Mapped pending item:', mapped);
                    return mapped;
                })
        );
    }, [tallyEntrySheet, user.firmNameMatch]);

    useEffect(() => {
        // Filter by firm name
        const filteredByFirm = tallyEntrySheet.filter(item => {
            const firmName = getFieldValue(item, 'Firm Name', 'firmName', 'firmNameMatch');
            return user.firmNameMatch.toLowerCase() === "all" || firmName === user.firmNameMatch;
        });
        
        setHistoryData(
            filteredByFirm
                .filter((i) => {
                    const planned4 = getFieldValue(i, 'Planned 4', 'planned4');
                    const actual4 = getFieldValue(i, 'Actual 4', 'actual4');
                    return planned4 !== '' && actual4 !== '';
                })
                .map((i) => {
                    const mapped = {
                        indentNo: getFieldValue(i, 'Indent Number', 'indentNumber', 'indentNo').toString().trim(),
                        firmNameMatch: getFieldValue(i, 'Firm Name', 'firmName', 'firmNameMatch').toString().trim(),
                        indentDate: getFieldValue(i, 'Indent Date', 'indentDate'),
                        purchaseDate: getFieldValue(i, 'Purchase Date', 'purchaseDate'),
                        materialInDate: getFieldValue(i, 'Material In Date', 'materialInDate'),
                        productName: getFieldValue(i, 'Product Name', 'productName'),
                        billNo: getFieldValue(i, 'Bill No.', 'billNo').toString(),
                        qty: Number(getFieldValue(i, 'Qty', 'qty')) || 0,
                        partyName: getFieldValue(i, 'Party Name', 'partyName'),
                        billAmt: Number(getFieldValue(i, 'Bill Amt', 'billAmt')) || 0,
                        billImage: getFieldValue(i, 'Bill Image', 'billImage'),
                        billReceivedLater: getFieldValue(i, 'Bill Recieved later', 'billReceivedLater'),
                        notReceivedBillNo: getFieldValue(i, 'Not Received Bill No.', 'notReceivedBillNo'),
                        location: getFieldValue(i, 'Location', 'location'),
                        typeOfBills: getFieldValue(i, 'Type Of Bills', 'typeOfBills'),
                        productImage: getFieldValue(i, 'Prodcut Image', 'Product Image', 'productImage'),
                        area: getFieldValue(i, 'Area', 'area'),
                        indentedFor: getFieldValue(i, 'Indented For', 'indentedFor'),
                        approvedPartyName: getFieldValue(i, 'Approved Party Name', 'approvedPartyName'),
                        rate: Number(getFieldValue(i, 'Rate', 'rate')) || 0,
                        indentQty: Number(getFieldValue(i, 'Indent Qty', 'indentQty')) || 0,
                        totalRate: Number(getFieldValue(i, 'Total Rate', 'totalRate')) || 0,
                        status1: getFieldValue(i, 'Status 1', 'status1'),
                        remarks1: getFieldValue(i, 'Remarks1', 'remarks1'),
                        status2: getFieldValue(i, 'Status 2', 'status2'),
                        remarks2: getFieldValue(i, 'Remarks 2', 'remarks2'),
                        status3: getFieldValue(i, 'Status 3', 'status3'),
                        remarks3: getFieldValue(i, 'Remarks 3', 'remarks3'),
                        status4: getFieldValue(i, 'Status 4', 'status4'),
                        remarks4: getFieldValue(i, 'Remarks 4', 'remarks4'),
                    };
                    console.log('📝 Mapped history item:', mapped);
                    return mapped;
                })
        );
    }, [tallyEntrySheet, user.firmNameMatch]);

    // Get unique party names for filter
    const partyNames = useMemo(() => {
        const allParties = [...pendingData, ...historyData]
            .map(item => item.partyName)
            .filter(Boolean) as string[];
        
        return ['all', ...Array.from(new Set(allParties))];
    }, [pendingData, historyData]);

    // Filter data based on selected party and search term
    const filteredPendingData = useMemo(() => {
        let filtered = pendingData;
        
        // Apply party name filter
        if (selectedPartyName !== 'all') {
            filtered = filtered.filter(item => item.partyName === selectedPartyName);
        }
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                item.indentNo.toLowerCase().includes(term) ||
                item.productName.toLowerCase().includes(term) ||
                item.billNo.toLowerCase().includes(term) ||
                (item.partyName && item.partyName.toLowerCase().includes(term)) ||
                item.firmNameMatch.toLowerCase().includes(term)
            );
        }
        
        return filtered;
    }, [pendingData, selectedPartyName, searchTerm]);

    const filteredHistoryData = useMemo(() => {
        let filtered = historyData;
        
        // Apply party name filter
        if (selectedPartyName !== 'all') {
            filtered = filtered.filter(item => item.partyName === selectedPartyName);
        }
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                item.indentNo.toLowerCase().includes(term) ||
                item.productName.toLowerCase().includes(term) ||
                item.billNo.toLowerCase().includes(term) ||
                (item.partyName && item.partyName.toLowerCase().includes(term)) ||
                item.firmNameMatch.toLowerCase().includes(term)
            );
        }
        
        return filtered;
    }, [historyData, selectedPartyName, searchTerm]);

    const pendingColumns: ColumnDef<TallyEntryPendingData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<TallyEntryPendingData> }) => {
                        const item = row.original;

                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedItem(item);
                                    }}
                                >
                                    Process
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        {
            accessorKey: 'indentDate',
            header: 'Indent Date',
            cell: ({ row }) => formatDate(row.original.indentDate)
        },
        {
            accessorKey: 'purchaseDate',
            header: 'Purchase Date',
            cell: ({ row }) => formatDate(row.original.purchaseDate)
        },
        {
            accessorKey: 'materialInDate',
            header: 'Material In Date',
            cell: ({ row }) => formatDate(row.original.materialInDate)
        },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date',
           cell: ({ row }) => formatDate(row.original.plannedDate)

        },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'billAmt', header: 'Bill Amt' },
        {
            accessorKey: 'billImage',
            header: 'Bill Image',
            cell: ({ row }) => {
                const image = row.original.billImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
        { accessorKey: 'notReceivedBillNo', header: 'Not Received Bill No.' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
        {
            accessorKey: 'productImage',
            header: 'Product Image',
            cell: ({ row }) => {
                const image = row.original.productImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'area', header: 'Area' },
        { accessorKey: 'indentedFor', header: 'Indented For' },
        { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'indentQty', header: 'Indent Qty' },
        { accessorKey: 'totalRate', header: 'Total Rate' },
        { accessorKey: 'status1', header: 'Status 1' },
        { accessorKey: 'remarks1', header: 'Remarks 1' },
        { accessorKey: 'status2', header: 'Status 2' },
        { accessorKey: 'remarks2', header: 'Remarks 2' },
        { accessorKey: 'status3', header: 'Status 3' },
        { accessorKey: 'remarks3', header: 'Remarks 3' },
    ];

    const historyColumns: ColumnDef<TallyEntryHistoryData>[] = [
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        {
            accessorKey: 'indentDate',
            header: 'Indent Date',
            cell: ({ row }) => formatDate(row.original.indentDate)
        },
        {
            accessorKey: 'purchaseDate',
            header: 'Purchase Date',
            cell: ({ row }) => formatDate(row.original.purchaseDate)
        },
        {
            accessorKey: 'materialInDate',
            header: 'Material In Date',
            cell: ({ row }) => formatDate(row.original.materialInDate)
        },
        { accessorKey: 'productName', header: 'Product Name' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'billAmt', header: 'Bill Amt' },
        {
            accessorKey: 'billImage',
            header: 'Bill Image',
            cell: ({ row }) => {
                const image = row.original.billImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },
        { accessorKey: 'notReceivedBillNo', header: 'Not Received Bill No.' },
        { accessorKey: 'location', header: 'Location' },
        { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
        {
            accessorKey: 'productImage',
            header: 'Product Image',
            cell: ({ row }) => {
                const image = row.original.productImage;
                return image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View
                    </a>
                ) : null;
            },
        },
        { accessorKey: 'area', header: 'Area' },
        { accessorKey: 'indentedFor', header: 'Indented For' },
        { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'indentQty', header: 'Indent Qty' },
        { accessorKey: 'totalRate', header: 'Total Rate' },
        {
            accessorKey: 'status1',
            header: 'Status 1',
            cell: ({ row }) => {
                const status = row.original.status1;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks1', header: 'Remarks 1' },
        {
            accessorKey: 'status2',
            header: 'Status 2',
            cell: ({ row }) => {
                const status = row.original.status2;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks2', header: 'Remarks 2' },
        {
            accessorKey: 'status3',
            header: 'Status 3',
            cell: ({ row }) => {
                const status = row.original.status3;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks3', header: 'Remarks 3' },
        {
            accessorKey: 'status4',
            header: 'Status 4',
            cell: ({ row }) => {
                const status = row.original.status4;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks4', header: 'Remarks 4' },
    ];

   const schema = z.object({
        status4: z
            .enum(['Done', 'Not Done'], {
                required_error: 'Please select a status',
            })
            .optional()
            .refine((val) => val !== undefined, {
                message: 'Please select a status',
            }),
        remarks4: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            status4: undefined as 'Done' | 'Not Done' | undefined,
            remarks4: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status4: undefined,
                remarks4: '',
            });
        }
    }, [openDialog, form]);

   async function onSubmit(values: z.infer<typeof schema>) {
    try {
        if (!selectedItem) {
            toast.error('No item selected');
            return;
        }

        console.log('🔄 Starting form submission...');
        console.log('📝 Selected item:', selectedItem);
        console.log('📋 Form values:', values);

        // Get current date in dd/mm/yyyy format for Actual 4
        const currentDate = new Date();
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        console.log('📅 Actual 4 date:', formattedDate);

        // Find the exact row in the original sheet data
        const sheetRow = tallyEntrySheet.find((s) => {
            const indentNumber = getFieldValue(s, 'Indent Number', 'indentNumber', 'indentNo').toString().trim();
            return indentNumber === selectedItem.indentNo;
        });

        if (!sheetRow) {
            console.error('❌ Could not find matching row in sheet data');
            toast.error('Could not find matching record in sheet');
            return;
        }

        console.log('✅ Found sheet row:', sheetRow);
        console.log('📊 Row index:', sheetRow.rowIndex);

        // Debug: Check what columns exist in the sheet
        console.log('🔍 Available columns in sheet row:', Object.keys(sheetRow));

        // Prepare update data with camelCase field names (matching what the backend expects)
        const updateData = [{
            rowIndex: sheetRow.rowIndex,
            // Use camelCase field names that match the backend's getCamelCaseHeaders conversion
            actual4: formattedDate,
            status4: values.status4,
            remarks4: values.remarks4
        }];

        console.log('📤 Update data to send:', updateData);

        // Debug: Check what the postToSheet function receives
        console.log('🔍 Sending to postToSheet with:', {
            data: updateData,
            action: 'update',
            sheet: 'TALLY ENTRY'
        });

        // Send update to sheet
        const result = await postToSheet(
            updateData,
            'update',
            'TALLY ENTRY'
        );

        console.log('✅ Update result:', result);

        toast.success(`Successfully updated tally entry for ${selectedItem.indentNo}`);
        setOpenDialog(false);
        
        // Refresh data after successful update
        setTimeout(() => {
            updateAll();
            console.log('🔄 Data refreshed after update');
        }, 1500);

    } catch (error) {
        console.error('❌ Update error:', error);
        toast.error('Failed to update tally entry. Please try again.');
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
                        heading="Tally Entry "
                        subtext="Process tally entries and manage status"
                        tabs
                    >
                        <Calculator size={50} className="text-primary" />
                    </Heading>

                    {/* Filter Controls Section */}
                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="w-full md:w-auto">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by Indent No., Product, Bill No., Party Name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 w-full md:w-[400px]"
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Filter by Party:</span>
                                    <Select
                                        value={selectedPartyName}
                                        onValueChange={setSelectedPartyName}
                                    >
                                        <SelectTrigger className="w-full md:w-[250px]">
                                            <SelectValue placeholder="Select Party Name" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Parties</SelectItem>
                                            {partyNames
                                                .filter(name => name !== 'all')
                                                .sort()
                                                .map((party) => (
                                                    <SelectItem key={party} value={party}>
                                                        {party}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedPartyName !== 'all' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedPartyName('all')}
                                            className="text-sm"
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Filter Summary */}
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                                Total Entries: {filteredPendingData.length + filteredHistoryData.length}
                            </div>
                            {selectedPartyName !== 'all' && (
                                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                                    Party: {selectedPartyName}
                                </div>
                            )}
                            {searchTerm && (
                                <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                                    Search: "{searchTerm}"
                                </div>
                            )}
                        </div>
                    </div>

                    <TabsContent value="pending">
                        <DataTable
                            data={filteredPendingData}
                            columns={pendingColumns}
                            searchFields={['indentNo', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={filteredHistoryData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'productName', 'partyName', 'billNo', 'status1', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                </Tabs>

                {selectedItem && (
                    <DialogContent className="sm:max-w-2xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Process Tally Entry</DialogTitle>
                                    <DialogDescription>
                                        Process entry for indent number{' '}
                                        <span className="font-medium">{selectedItem.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Entry Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent No.</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.indentNo}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Firm Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.firmNameMatch}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Product Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.productName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Party Name</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.partyName}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Bill No.</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.billNo}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Quantity</p>
                                            <p className="text-sm font-light">{selectedItem.qty}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Bill Amount</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.billAmt}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status4"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Done">Done</SelectItem>
                                                        <SelectItem value="Not Done">
                                                            Not Done
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="remarks4"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Remarks *</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Enter remarks..."
                                                        {...field}
                                                        rows={4}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
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
                                        Update Status
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