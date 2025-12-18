import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
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
import { Calculator } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';

interface TallyEntryPendingData {
    indentNo: string;
    indentDate: string;
    purchaseDate: string;
    materialInDate: string;
    plannedDate: string; // ✅ ADD THIS
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
    firmNameMatch: string;
}

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

// Helper function to get field value with multiple possible keys
const getFieldValue = (item: any, ...possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
            return item[key];
        }
    }
    return '';
};

export default () => {
    const { tallyEntrySheet, updateAll } = useSheets();
    const { user } = useAuth();

    const [pendingData, setPendingData] = useState<TallyEntryPendingData[]>([]);
    const [historyData, setHistoryData] = useState<TallyEntryHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<TallyEntryPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

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
                    const planned2 = getFieldValue(i, 'Planned 2', 'planned2');
                    const actual2 = getFieldValue(i, 'Actual 2', 'actual2');
                    return planned2 !== '' && actual2 === '';
                })
                .map((i) => {
                    const mapped = {
                        indentNo: getFieldValue(i, 'Indent Number', 'indentNumber', 'indentNo').toString().trim(),
                        firmNameMatch: getFieldValue(i, 'Firm Name', 'firmName', 'firmNameMatch').toString().trim(),
                        indentDate: getFieldValue(i, 'Indent Date', 'indentDate'),
                        purchaseDate: getFieldValue(i, 'Purchase Date', 'purchaseDate'),
                        materialInDate: getFieldValue(i, 'Material In Date', 'materialInDate'),
                        plannedDate: getFieldValue(i, 'Planned 2', 'planned2'), // ✅ ADD THIS
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
                    };
                    console.log('📝 Mapped item:', mapped);
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
                    const planned2 = getFieldValue(i, 'Planned 2', 'planned2');
                    const actual2 = getFieldValue(i, 'Actual 2', 'actual2');
                    return planned2 !== '' && actual2 !== '';
                })
                .map((i) => ({
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
                }))
        );
    }, [tallyEntrySheet, user.firmNameMatch]);

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
        { 
            accessorKey: 'indentNo', 
            header: 'Indent No.',
        },
        { 
            accessorKey: 'firmNameMatch', 
            header: 'Firm Name',
        },
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
            cell: ({ row }) => formatDate(row.original.plannedDate) // ✅ ADD THIS COLUMN
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
    ];

    const historyColumns: ColumnDef<TallyEntryHistoryData>[] = [
        { 
            accessorKey: 'indentNo', 
            header: 'Indent No.',
        },
        { 
            accessorKey: 'firmNameMatch', 
            header: 'Firm Name',
        },
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
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status1;
                const variant = status === 'Done' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        { accessorKey: 'remarks1', header: 'Remarks' },
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
    ];

    const schema = z.object({
        status2: z
            .enum(['Done', 'Not Done'], {
                required_error: 'Please select a status',
            })
            .optional()
            .refine((val) => val !== undefined, {
                message: 'Please select a status',
            }),
        remarks2: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            status2: undefined as 'Done' | 'Not Done' | undefined,
            remarks2: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset({
                status2: undefined,
                remarks2: '',
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

        // Get current date and time in dd/mm/yyyy hh:mm:ss format
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

        console.log('📅 Actual 2 date:', currentDateTime);

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

        // Prepare update data with ONLY the 3 fields we want to update (using camelCase)
        const updateData = [{
            rowIndex: sheetRow.rowIndex,
            actual2: currentDateTime,
            status2: values.status2,
            remarks2: values.remarks2
        }];

        console.log('📤 Update data to send:', updateData);

        // Send update to sheet
        const result = await postToSheet(
            updateData,
            'update',
            'TALLY ENTRY'
        );

        console.log('✅ Update result:', result);

        toast.success(`Successfully updated status for ${selectedItem.indentNo}`);
        setOpenDialog(false);
        
        // Refresh data after successful update
        setTimeout(() => {
            updateAll();
            console.log('🔄 Data refreshed after update');
        }, 1500);

    } catch (error) {
        console.error('❌ Update error:', error);
        toast.error('Failed to update status. Please try again.');
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
                        heading="Rectify The Mistake"
                        subtext="Process tally entries and manage status"
                        tabs
                    >
                        <Calculator size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={pendingColumns}
                            searchFields={['indentNo', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
                            dataLoading={false}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
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
                                            <p className="font-medium text-nowrap">Indent Date</p>
                                            <p className="text-sm font-light">
                                                {formatDate(selectedItem.indentDate)}
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
                                        <div className="space-y-1">
                                            <p className="font-medium">Location</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.location}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Area</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.area}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Rate</p>
                                            <p className="text-sm font-light">
                                                {selectedItem.rate}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status2"
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
                                        name="remarks2"
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
};