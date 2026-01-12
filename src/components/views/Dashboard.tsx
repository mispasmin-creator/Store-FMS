import Heading from '../element/Heading';
import {
    Calendar as CalendarIcon,
    ClipboardList,
    LayoutDashboard,
    PackageCheck,
    Truck,
    Warehouse,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { ComboBox } from '../ui/combobox';

interface ChartDataItem {
    name: string;
    quantity: number;
    frequency: number;
}

interface VendorDataItem {
    name: string;
    orders: number;
    quantity: number;
}

interface StatsData {
    count: number;
    quantity: number;
}

interface AlertsData {
    lowStock: number;
    outOfStock: number;
}

interface IndentSheetItem {
    planned4?: string;
    actual4?: string;
    approvedVendorName?: string | number;
    firmName?: string;
    indentNumber?: string;
    productName?: string;
    specifications?: string;
    taxValue1?: string | number;
    taxValue4?: string | number;
    approvedQuantity?: number;
    uom?: string;
    approvedRate?: number;
    vendorType?: string;
    actual1?: string;
    planned1?: string;
    quantity?: number;
}

interface ReceivedSheetItem {
    poNumber?: string;
    quantity?: number;
    vendorName?: string;
    productName?: string;
}

interface StoreInSheetItem {
    liftNumber?: string;
    qty?: number;
    actual6?: string;
}

function CustomChartTooltipContent({
    payload,
    label,
}: {
    payload?: { payload: { quantity: number; frequency: number } }[];
    label?: string;
}) {
    if (!payload?.length) return null;

    const data = payload[0].payload;

    return (
        <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
            <p className="font-medium">{label}</p>
            <p>Quantity: {data.quantity}</p>
            <p>Frequency: {data.frequency}</p>
        </div>
    );
}

export default function Dashboard() {
    const { receivedSheet, indentSheet, storeInSheet, inventoryLoading } = useSheets();
    
    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [topVendorsData, setTopVendors] = useState<VendorDataItem[]>([]);
    const [indent, setIndent] = useState<StatsData>({ count: 0, quantity: 0 });
    const [purchase, setPurchase] = useState<StatsData>({ count: 0, quantity: 0 });
    const [out, setOut] = useState<StatsData>({ count: 0, quantity: 0 });
    const [alerts, setAlerts] = useState<AlertsData>({ lowStock: 0, outOfStock: 0 });

    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
    const [allVendors, setAllVendors] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<string[]>([]);

    useEffect(() => {
        if (!indentSheet || !receivedSheet || !storeInSheet) return;

        // Get unique vendors and products
        const vendors = Array.from(
            new Set(
                indentSheet
                    .filter((item: IndentSheetItem) => item.approvedVendorName)
                    .map((item: IndentSheetItem) => String(item.approvedVendorName))
            )
        );
        setAllVendors(vendors);

        const products = Array.from(
            new Set(
                indentSheet
                    .filter((item: IndentSheetItem) => item.productName)
                    .map((item: IndentSheetItem) => item.productName || '')
            )
        );
        setAllProducts(products);

        // Filter data by date range, vendors, and products
        const filterByDateAndSelection = (item: IndentSheetItem) => {
            let valid = true;

            if (startDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate >= startDate;
            }

            if (endDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate <= endDate;
            }

            if (filteredVendors.length > 0 && item.approvedVendorName) {
                valid = valid && filteredVendors.includes(String(item.approvedVendorName));
            }

            if (filteredProducts.length > 0 && item.productName) {
                valid = valid && filteredProducts.includes(item.productName);
            }

            return valid;
        };

        // Calculate Approved Indents (actual1 is filled)
        const approvedIndents = indentSheet.filter(
            (item: IndentSheetItem) => item.actual1 && filterByDateAndSelection(item)
        );
        const totalApprovedQuantity = approvedIndents.reduce(
            (sum: number, item: IndentSheetItem) => sum + (item.approvedQuantity || 0),
            0
        );
        setIndent({ count: approvedIndents.length, quantity: totalApprovedQuantity });

        // Calculate Purchases (from receivedSheet)
        const filterReceived = (item: ReceivedSheetItem) => {
            let valid = true;
            if (filteredVendors.length > 0 && item.vendorName) {
                valid = valid && filteredVendors.includes(item.vendorName);
            }
            if (filteredProducts.length > 0 && item.productName) {
                valid = valid && filteredProducts.includes(item.productName);
            }
            return valid;
        };

        const purchases = receivedSheet.filter(filterReceived);
        const totalPurchasedQuantity = purchases.reduce(
            (sum: number, item: ReceivedSheetItem) => sum + (item.quantity || 0),
            0
        );
        setPurchase({ count: purchases.length, quantity: totalPurchasedQuantity });

        // Calculate Out/Issued (from storeInSheet with actual6 filled)
        const issued = storeInSheet.filter((item: StoreInSheetItem) => item.actual6);
        const totalIssuedQuantity = issued.reduce(
            (sum: number, item: StoreInSheetItem) => sum + (item.qty || 0),
            0
        );
        setOut({ count: issued.length, quantity: totalIssuedQuantity });

        // Calculate Top Products by frequency and quantity
        const productMap: Record<string, { frequency: number; quantity: number }> = {};
        approvedIndents.forEach((item: IndentSheetItem) => {
            if (item.productName) {
                if (!productMap[item.productName]) {
                    productMap[item.productName] = { frequency: 0, quantity: 0 };
                }
                productMap[item.productName].frequency += 1;
                productMap[item.productName].quantity += item.approvedQuantity || 0;
            }
        });

        const topProducts = Object.entries(productMap)
            .map(([name, data]) => ({
                name,
                frequency: data.frequency,
                quantity: data.quantity,
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        setChartData(topProducts);

        // Calculate Top Vendors
        const vendorMap: Record<string, { orders: number; quantity: number }> = {};
        approvedIndents.forEach((item: IndentSheetItem) => {
            const vendorName = String(item.approvedVendorName || '');
            if (vendorName) {
                if (!vendorMap[vendorName]) {
                    vendorMap[vendorName] = { orders: 0, quantity: 0 };
                }
                vendorMap[vendorName].orders += 1;
                vendorMap[vendorName].quantity += item.approvedQuantity || 0;
            }
        });

        const topVendors = Object.entries(vendorMap)
            .map(([name, data]) => ({
                name,
                orders: data.orders,
                quantity: data.quantity,
            }))
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 5);

        setTopVendors(topVendors);

        // For now, set alerts to 0 (you can implement inventory tracking logic)
        setAlerts({ lowStock: 0, outOfStock: 0 });

    }, [startDate, endDate, filteredProducts, filteredVendors, indentSheet, receivedSheet, storeInSheet]);

    const chartConfig = {
        quantity: {
            label: 'Quantity',
            color: 'var(--color-primary)',
        },
    } satisfies ChartConfig;

    return (
        <div>
            <Heading heading="Dashboard" subtext="View your analytics">
                <LayoutDashboard size={50} className="text-primary" />
            </Heading>

            <div className="grid gap-3 m-3">
                <div className="gap-3 grid grid-cols-2 md:grid-cols-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!startDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? (
                                    format(startDate, 'PPP')
                                ) : (
                                    <span>Pick a start date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!endDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, 'PPP') : <span>Pick an end date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                        </PopoverContent>
                    </Popover>
                    <ComboBox
                        multiple
                        options={allVendors.map((v) => ({ label: v, value: v }))}
                        value={filteredVendors}
                        onChange={setFilteredVendors}
                        placeholder="Select Vendors"
                    />
                    <ComboBox
                        multiple
                        options={allProducts.map((v) => ({ label: v, value: v }))}
                        value={filteredProducts}
                        onChange={setFilteredProducts}
                        placeholder="Select Products"
                    />
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-transparent to-blue-500/10">
                        <CardContent className="pt-6">
                            <div className="text-blue-500 flex justify-between">
                                <p className="font-semibold">Total Approved Indents</p>
                                <ClipboardList size={18} />
                            </div>
                            <p className="text-3xl font-bold text-blue-800">{indent.count}</p>
                            <div className="text-blue-500 flex justify-between">
                                <p className="text-sm">Indented Quantity</p>
                                <p>{indent.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-green-500/10">
                        <CardContent className="pt-6">
                            <div className="text-green-500 flex justify-between">
                                <p className="font-semibold">Total Purchases</p>
                                <Truck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-green-800">{purchase.count}</p>
                            <div className="text-green-500 flex justify-between">
                                <p className="text-sm">Purchased Quantity</p>
                                <p>{purchase.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-orange-500/10">
                        <CardContent className="pt-6">
                            <div className="text-orange-500 flex justify-between">
                                <p className="font-semibold">Total Issued</p>
                                <PackageCheck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-orange-800">{out.count}</p>

                            <div className="text-orange-500 flex justify-between">
                                <p className="text-sm">Out Quantity</p>
                                <p>{out.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-yellow-500/10 text-yellow-500">
                        <CardContent className="pt-6">
                            <div className="flex justify-between">
                                <p className="font-semibold">Out of Stock</p>
                                <Warehouse size={18} />
                            </div>
                            <p className="text-3xl font-bold text-yellow-800">
                                {alerts.outOfStock}
                            </p>

                            <div className="text-yellow-500 flex justify-between">
                                <p className="text-sm">Low in Stock</p>
                                <p>{alerts.lowStock}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Card className="w-[55%] md:min-w-150 flex-grow">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Purchased Products</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.length > 0 ? (
                                <ChartContainer className="max-h-80 w-full" config={chartConfig}>
                                    <BarChart
                                        accessibilityLayer
                                        data={chartData}
                                        layout="vertical"
                                        margin={{
                                            right: 16,
                                        }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="barGradient"
                                                x1="0"
                                                y1="0"
                                                x2="1"
                                                y2="0"
                                            >
                                                <stop offset="100%" stopColor="#3b82f6" />
                                                <stop offset="0%" stopColor="#2563eb" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid horizontal={false} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tickLine={false}
                                            tickMargin={10}
                                            axisLine={false}
                                            tickFormatter={(value: string) => value.slice(0, 15)}
                                            hide
                                        />
                                        <XAxis dataKey="frequency" type="number" hide />
                                        <ChartTooltip
                                            cursor={false}
                                            content={<CustomChartTooltipContent />}
                                        />
                                        <Bar
                                            dataKey="frequency"
                                            layout="vertical"
                                            fill="url(#barGradient)"
                                            radius={4}
                                        >
                                            <LabelList
                                                dataKey="name"
                                                position="insideLeft"
                                                offset={8}
                                                className="fill-white font-semibold"
                                                fontSize={12}
                                            />
                                            <LabelList
                                                dataKey="frequency"
                                                position="insideRight"
                                                offset={8}
                                                className="fill-white font-semibold"
                                                fontSize={12}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <div className="flex items-center justify-center h-80 text-muted-foreground">
                                    No data available for selected filters
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="flex-grow min-w-60 w-[40%]">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Vendors</CardTitle>
                        </CardHeader>
                        <CardContent className="text-base grid gap-2">
                            {topVendorsData.length > 0 ? (
                                topVendorsData.map((vendor, i) => (
                                    <div className="flex justify-between" key={i}>
                                        <p className="font-semibold text-md">{vendor.name}</p>
                                        <div className="flex gap-5">
                                            <p>{vendor.orders} Orders</p>
                                            <p>{vendor.quantity} Items</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No vendor data available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}