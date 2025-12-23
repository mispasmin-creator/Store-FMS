import { FileText, Building, DollarSign, CheckCircle, AlertCircle, ExternalLink, CheckSquare, XSquare } from 'lucide-react';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { Checkbox } from '../ui/checkbox';

interface PaymentsRecord {
    rowIndex?: number;
    timestamp?: string;
    uniqueNo?: string;
    partyName?: string;
    poNumber?: string;
    totalPoAmount?: string | number;
    internalCode?: string;
    product?: string;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    pdf?: string;
    payAmount?: string | number;
    file?: string;
    remark?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    planned?: string;
    actual?: string;
    delay?: string;
    status1?: string;
    paymentForm?: string;
    firmNameMatch?: string;
}

interface DisplayPayment {
    rowIndex: number;
    uniqueNo: string;
    partyName: string;
    poNumber: string;
    totalPoAmount: number;
    internalCode: string;
    product: string;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: number;
    pdf: string;
    payAmount: number;
    file: string;
    remark: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    planned: string;
    actual: string;
    delay: string;
    status1: string;
    paymentForm: string;
    firmNameMatch: string;
}

interface UpdatePayload {
    rowIndex: number;
    actual: string;
    status: string;
    status1: string;
}

export default function MakePayment() {
    const { paymentsLoading, paymentsSheet, updateAll } = useSheets();
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<DisplayPayment[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [originalData, setOriginalData] = useState<PaymentsRecord[]>([]);
    
    const [stats, setStats] = useState({
        total: 0,
        totalAmount: 0,
        pendingCount: 0
    });

    useEffect(() => {
        console.log('🔍 MakePayment useEffect triggered');
        
        try {
            const safePaymentsSheet: PaymentsRecord[] = Array.isArray(paymentsSheet) ? paymentsSheet : [];
            setOriginalData(safePaymentsSheet);
            
            console.log('📊 Total payments sheet records:', safePaymentsSheet.length);
            
            // ✅ FIXED: Enhanced filter logic with better debugging
            const pendingItems = safePaymentsSheet
                .filter((sheet: PaymentsRecord) => {
                    // Convert to string and trim
                    const plannedValue = String(sheet?.planned || '').trim();
                    const actualValue = String(sheet?.actual || '').trim();
                    
                    const hasPlanned = plannedValue !== '';
                    const hasActual = actualValue !== '';
                    
                    const shouldShow = hasPlanned && !hasActual;
                    
                    // Debug specific records
                    if (sheet?.poNumber) {
                        console.log(`🔍 Checking ${sheet.poNumber}:`, {
                            planned: plannedValue,
                            actual: actualValue,
                            hasPlanned,
                            hasActual,
                            shouldShow
                        });
                    }
                    
                    return shouldShow;
                })
                .map((sheet: PaymentsRecord, index) => {
                    // Create display data
                    return {
                        rowIndex: sheet?.rowIndex || index,
                        uniqueNo: sheet?.uniqueNo || '',
                        partyName: sheet?.partyName || '',
                        poNumber: sheet?.poNumber || '',
                        totalPoAmount: Number(sheet?.totalPoAmount || 0),
                        internalCode: sheet?.internalCode || '',
                        product: sheet?.product || '',
                        deliveryDate: sheet?.deliveryDate || '',
                        paymentTerms: sheet?.paymentTerms || '',
                        numberOfDays: Number(sheet?.numberOfDays || 0),
                        pdf: sheet?.pdf || '',
                        payAmount: Number(sheet?.payAmount || 0),
                        file: sheet?.file || '',
                        remark: sheet?.remark || '',
                        totalPaidAmount: Number(sheet?.totalPaidAmount || 0),
                        outstandingAmount: Number(sheet?.outstandingAmount || 0),
                        status: sheet?.status || 'Pending',
                        planned: sheet?.planned || '',
                        actual: sheet?.actual || '',
                        delay: sheet?.delay || '',
                        status1: sheet?.status1 || '',
                        paymentForm: sheet?.paymentForm || '',
                        firmNameMatch: sheet?.firmNameMatch || '',
                    };
                });

            console.log('✅ Final pending items found:', pendingItems.length);
            
            setPendingData(pendingItems);
            
            const totalAmount = pendingItems.reduce((sum, item) => sum + item.outstandingAmount, 0);
            setStats({
                total: pendingItems.length,
                totalAmount,
                pendingCount: pendingItems.length
            });

            // Clear selected rows when data changes
            setSelectedRows(new Set());

        } catch (error) {
            console.error('❌ Error in Make Payment useEffect:', error);
            setPendingData([]);
        }
    }, [paymentsSheet]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            // Try multiple date formats
            let date = new Date(dateString);
            
            if (isNaN(date.getTime())) {
                // Try DD/MM/YYYY
                const parts = dateString.split('/');
                if (parts.length === 3) {
                    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            }
            
            if (isNaN(date.getTime())) {
                // Try YYYY-MM-DD
                date = new Date(dateString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
            }
            
            if (isNaN(date.getTime())) {
                return dateString; // Return original if can't parse
            }
            
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
        } catch (error) {
            console.warn('Date formatting error:', error);
            return dateString;
        }
    };

    const formatCurrentDate = (): string => {
        const now = new Date();
        return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    };

    const formatCurrentDateTime = (): string => {
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const handleSelectAll = () => {
        if (selectedRows.size === pendingData.length) {
            // If all are selected, deselect all
            setSelectedRows(new Set());
        } else {
            // Select all
            const allRowIndices = pendingData.map((_, index) => index);
            setSelectedRows(new Set(allRowIndices));
        }
    };

    const handleSelectRow = (rowIndex: number) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(rowIndex)) {
            newSelected.delete(rowIndex);
        } else {
            newSelected.add(rowIndex);
        }
        setSelectedRows(newSelected);
    };

    const handleSubmitSelected = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one payment to mark as completed');
            return;
        }

        setIsSubmitting(true);
        const currentDate = formatCurrentDate();

        try {
            // Get the selected items
            const selectedItems = Array.from(selectedRows).map(index => pendingData[index]);
            
            console.log('🔍 Selected items to update:', selectedItems);
            
            // Create updates with CORRECT row index calculation
            const updates: UpdatePayload[] = selectedItems.map(item => {
                // Calculate the correct row number in Google Sheet
                const actualSheetRow = item.rowIndex + 5; // rowIndex + header offset
                
                console.log('📝 Preparing update for:', {
                    poNumber: item.poNumber,
                    uniqueNo: item.uniqueNo,
                    arrayIndex: item.rowIndex,
                    calculatedSheetRow: actualSheetRow,
                    currentStatus: item.status
                });
                
                return {
                    rowIndex: actualSheetRow,
                    actual: currentDate,
                    status: 'Completed',
                    status1: 'ok'
                };
            });
            
            console.log('📤 Submitting updates to Google Sheet:', updates);
            
            if (updates.length === 0) {
                toast.error('Could not find matching records to update');
                setIsSubmitting(false);
                return;
            }

            // Update the Google Sheet
            const result = await postToSheet(updates, 'update', 'Payments');
            
            console.log('✅ Update result:', result);
            
            if (result.success) {
                toast.success(`Successfully updated ${updates.length} payment(s)`);
                
                // Show what was updated
                const updatedItems = selectedItems.map(item => 
                    `${item.poNumber} (${item.uniqueNo})`
                ).join(', ');
                
                toast.info(`Updated: ${updatedItems}`);
                
                // Refresh the data
                setTimeout(() => {
                    updateAll();
                }, 1000);
                
                // Clear selected rows
                setSelectedRows(new Set());
            } else {
                console.error('❌ Update failed:', result);
                toast.error(`Failed to update payments: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Error submitting payments:', error);
            toast.error('Error updating payments. Check console for details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingColumns: ColumnDef<DisplayPayment>[] = [
        {
            id: 'select',
            header: () => (
                <div className="flex items-center">
                    <Checkbox
                        checked={selectedRows.size === pendingData.length && pendingData.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="mr-2"
                    />
                    Select
                </div>
            ),
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const isSelected = selectedRows.has(row.index);
                return (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(row.index)}
                        className="mr-2"
                    />
                );
            },
        },
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const item = row.original;
                const hasPaymentForm = item.paymentForm?.trim() !== '';
                
                return (
                    <div className="flex gap-2">
                        {hasPaymentForm ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => window.open(item.paymentForm, '_blank')}
                                className="bg-green-600 hover:bg-green-700 shadow-sm"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                Make Payment
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-gray-400"
                            >
                                No Form Link
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'uniqueNo',
            header: 'Payment No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.uniqueNo || '-'}
                </div>
            )
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <div className="font-medium text-purple-700">
                    <div>{row.original.poNumber || '-'}</div>
                </div>
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
                const isPending = status === 'pending' || status === '';
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
            accessorKey: 'planned',
            header: 'Planned Date',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-blue-600">
                    {formatDate(row.original.planned) || '-'}
                </span>
            )
        },
        
    ];

    const handleRefresh = () => {
        console.log('🔄 Manually refreshing data...');
        updateAll();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-600 rounded-lg shadow">
                                <DollarSign size={28} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Make Payment</h1>
                                <p className="text-gray-600">Select payments to mark as completed and submit</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedRows.size > 0 && (
                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">
                                        {selectedRows.size} selected
                                    </span>
                                </div>
                            )}
                            <Button 
                                onClick={handleRefresh}
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-blue-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Outstanding Amount</p>
                                        <p className="text-2xl font-bold text-red-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Selected</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            {selectedRows.size}
                                        </p>
                                    </div>
                                    <CheckSquare className="h-10 w-10 text-green-500" />
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
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Payment Forms</CardTitle>
                                
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-500">
                                    {selectedRows.size > 0 ? (
                                        <span className="font-medium text-green-600">
                                            {selectedRows.size} payment(s) selected
                                        </span>
                                    ) : (
                                        'Select payments to submit'
                                    )}
                                </div>
                                {selectedRows.size > 0 && (
                                    <Button
                                        onClick={handleSubmitSelected}
                                        disabled={isSubmitting}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <CheckSquare className="mr-2 h-4 w-4" />
                                                Submit Selected ({selectedRows.size})
                                            </>
                                        )}
                                    </Button>
                                )}
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-300">
                                    {stats.pendingCount > 0 ? (
                                        <>
                                            <AlertCircle className="mr-1 h-3 w-3" />
                                            {stats.total} Pending
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="mr-1 h-3 w-3" />
                                            All Completed
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {paymentsLoading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Payment Data...</h3>
                                <p className="text-gray-500">Fetching data from Payments sheet</p>
                                <Button 
                                    onClick={handleRefresh} 
                                    variant="outline" 
                                    className="mt-4"
                                >
                                    Retry Loading
                                </Button>
                            </div>
                        ) : pendingData.length > 0 ? (
                            <>
                                {/* Selection Summary Bar */}
                                {selectedRows.size > 0 && (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckSquare className="h-5 w-5 text-green-600" />
                                                <span className="font-medium text-green-800">
                                                    {selectedRows.size} payment(s) selected
                                                </span>
                                                <span className="text-sm text-green-600">
                                                    - Will update: Actual date to {formatCurrentDate()}, Status to "Completed", Status1 to "ok"
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSelectedRows(new Set())}
                                                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                                >
                                                    <XSquare className="mr-1 h-3 w-3" />
                                                    Clear All
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                               
                                
                                {/* Data Table */}
                                <DataTable<DisplayPayment, ColumnDef<DisplayPayment>>
                                    data={pendingData}
                                    columns={pendingColumns}
                                    searchFields={['uniqueNo', 'poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                    dataLoading={false}
                                    className="border rounded-lg"
                                />
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Payment Forms</h3>
                                
                                
                                <div className="mt-6">
                                    <Button 
                                        onClick={handleRefresh}
                                        variant="default"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Refresh Data
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}