'use client'
import React, { useState, useEffect, useRef } from 'react';

import Map from '@/app/ui/public/map'
import PublicSideNav from '@/app/ui/public/public-sidenav'
import { productImageDir } from '../constants';
import { units } from '../constants';
import { products } from '../constants';

/**
 * Individual radar: optional fixed filename-timestamp window for testing (UTC).
 * Set to null to use the API default (rolling last 1 hour from current instant, UTC).
 */
const XBAND_TEST_WINDOW: { start: string; end: string } | null = null;
// const XBAND_TEST_WINDOW = { 
//    start: '20260412-154500', 
//    end: '20260412-155500' 
//};

type XBandProdDetails = {
    id: string;
    name: string;
    day: string;
    date: string;
    time: string;
};

export default function Public() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [images, setImages] = useState<string[]>([])
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isIndividualRadarView, setIsIndividualRadarView] = useState(true);

    // Placeholder radar names — update folder keys to match actual XQPI radar folder names
    const [leftRadar, setLeftRadar] = useState('FLOW');
    const [leftRadarProduct, setLeftRadarProduct] = useState('Reflectivity');
    const [rightRadar, setRightRadar] = useState('KSOX');
    const [rightRadarProduct, setRightRadarProduct] = useState('Reflectivity');

    const radarCodeToFolder: Record<string, string> = {
        FLOW: 'FLOW',
        KSOX: 'KSOX',
        KVTX: 'KVTX',
    };

    const radarProductToPrefix: Record<string, string> = {
        'Reflectivity': 'Reflectivity',
        'Differential Reflectivity': 'DifferentialReflectivity', 
        'Velocity': 'Velocity',
        'PhiDP': 'DifferentialPhase', 
        'RhoHV': 'RhoHV',
    };

    const radarProductToColorbar: Record<string, string> = {
        Reflectivity: '/xband_radar_data/colourbar/reflectivity.png',
        'Differential Reflectivity': '/xband_radar_data/colourbar/differential_reflectivity.png',
        Velocity: '/xband_radar_data/colourbar/radial_velocity.png',
        PhiDP: '/xband_radar_data/colourbar/differential_phase.png',
        RhoHV: '/xband_radar_data/colourbar/rhohv.png',
    };

    const radarProductToUnit: Record<string, string> = {
        Reflectivity: 'dBZ',
        'Differential Reflectivity': 'dBZ',
        Velocity: 'm/s',
        PhiDP: 'deg',
        RhoHV: 'RhoHV',
    };

    const [leftImages, setLeftImages] = useState<string[]>([]);
    const [rightImages, setRightImages] = useState<string[]>([]);
    const [leftMeta, setLeftMeta] = useState<Array<{ timestamp: string; date: string; day: string; time: string }>>([]);
    const [rightMeta, setRightMeta] = useState<Array<{ timestamp: string; date: string; day: string; time: string }>>([]);

    const [leftColorbar, setLeftColorbar] = useState('');
    const [rightColorbar, setRightColorbar] = useState('');
    const [leftUnit, setLeftUnit] = useState('');
    const [rightUnit, setRightUnit] = useState('');
    const [leftProductInfo, setLeftProductInfo] = useState('');
    const [rightProductInfo, setRightProductInfo] = useState('');
    const [leftProdDetails, setLeftProdDetails] = useState<XBandProdDetails>({
        id: '',
        name: 'Reflectivity',
        day: '',
        date: '',
        time: '',
    });
    const [rightProdDetails, setRightProdDetails] = useState<XBandProdDetails>({
        id: '',
        name: 'Reflectivity',
        day: '',
        date: '',
        time: '',
    });

    const [xbandRefreshTick, setXbandRefreshTick] = useState(0);
    const [leftXbandIndex, setLeftXbandIndex] = useState(0);
    const [rightXbandIndex, setRightXbandIndex] = useState(0);
    const leftImagesRef = useRef<string[]>([]);
    const rightImagesRef = useRef<string[]>([]);
    leftImagesRef.current = leftImages;
    rightImagesRef.current = rightImages;

    const [unit, setUnit] = useState(units.in)
    const currUnit = useRef(unit);
    const [productPath, setproductPath] = useState(productImageDir.atmosphericForecast.total_precip);
    const [opacity, setOpacity] = useState(1);
    const [colorbar, setColorbar] = useState(productImageDir.atmosphericForecast.total_precip.colorbar.in);
    const [prod_details, SetProdDetails] = useState({
        id: 'individual_radar',
        name: 'Precipitation',
        day: '',
        date: '',
        time: ''
    });
    const [productInfo, setProductInfo] = useState(productImageDir.atmosphericForecast.total_precip.info);
    const rainfall_units = [products.radarData.qpe_15min, products.radarData.qpe_1hr, products.radarData.pr,
    products.forecast.pr, products.forecast.tp]
    const forecast_products = [products.radarData.com_nowcast, products.forecast.pr, products.forecast.tp, products.forecast.temp]

    useEffect(() => {
        let details_json_path = '';
        if (rainfall_units.includes(productPath.id)) {
            const temp_unt = (unit == 'in/hr' || unit == 'mm/hr') ? unit.split('/')[0] : unit;
            details_json_path = productPath.details[temp_unt];
        } else if (productPath.id == productImageDir.atmosphericForecast.temp.id) {
            const temp_unt = (unit == productImageDir.atmosphericForecast.temp.unit.F) ? productImageDir.atmosphericForecast.temp.unit.F : 'DEG';
            details_json_path = productPath.details[temp_unt];
        } else {
            details_json_path = productPath.details;
        }
        fetchDetailsJSON(details_json_path);
    }, [productPath]);

    useEffect(() => {
        if (selectedProduct != null) {
            SetProdDetails({
                ...prod_details,
                ['date']: selectedProduct['steps'][currentIndex]['date'],
                ['day']: selectedProduct['steps'][currentIndex]['day'],
                ['time']: selectedProduct['steps'][currentIndex]['time'],
            });
        }
    }, [currentIndex]);

    useEffect(() => {
        if (selectedProduct != null) {
            var productImages = []
            if (rainfall_units.includes(productPath.id)) {
                const temp_unt = (unit == 'in/hr' || unit == 'mm/hr') ? unit.split('/')[0] : unit;
                productImages = selectedProduct.steps.map(step => productPath.images + temp_unt + '/' + step.imageName);
            } else if (productPath.id == productImageDir.atmosphericForecast.temp.id) {
                const temp_unt = (unit == productImageDir.atmosphericForecast.temp.unit.F) ? productImageDir.atmosphericForecast.temp.unit.F : 'Deg';
                productImages = selectedProduct.steps.map(step => productPath.images + temp_unt + '/' + step.imageName);
            } else {
                productImages = selectedProduct.steps.map(step => productPath.images + step.imageName);
            }
            setImages(productImages);
            if (isPlaying) {
                if (intervalId) clearInterval(intervalId);
                setIsPlaying(false);
            }
            if (forecast_products.includes(productPath.id)) {
                setCurrentIndex(0);
                SetProdDetails({
                    id: productPath.id,
                    name: selectedProduct.product,
                    day: selectedProduct.steps[0].day,
                    date: selectedProduct.steps[0].date,
                    time: selectedProduct.steps[0].time,
                });
            } else {
                setCurrentIndex(productImages.length - 1);
                SetProdDetails({
                    id: productPath.id,
                    name: selectedProduct.product,
                    day: selectedProduct.steps[productImages.length - 1].day,
                    date: selectedProduct.steps[productImages.length - 1].date,
                    time: selectedProduct.steps[productImages.length - 1].time,
                });
            }
        }
    }, [selectedProduct])

    const fetchDetailsJSON = (path: string) => {
        fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                setSelectedProduct(data);
                SetProdDetails({
                    ...prod_details,
                    ['id']: productPath.id,
                    ['date']: data['steps'][data['steps'].length - 1]['date'],
                    ['day']: data['steps'][data['steps'].length - 1]['day'],
                    ['time']: data['steps'][data['steps'].length - 1]['time'],
                })
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    // Stop animation when switching to/from individual radar view or changing radar selection
    useEffect(() => {
        if (!isIndividualRadarView) return;
        if (intervalId) clearInterval(intervalId);
        setIsPlaying(false);
    }, [isIndividualRadarView, leftRadar, leftRadarProduct, rightRadar, rightRadarProduct]);

    // Refresh xband images every 60s
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const id = setInterval(() => setXbandRefreshTick((t) => t + 1), 60_000);
        return () => clearInterval(id);
    }, [isIndividualRadarView]);

    // Fetch left radar image sequence
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const radarFolder = radarCodeToFolder[leftRadar];
        const productPrefix = radarProductToPrefix[leftRadarProduct];
        // Look for this block around Line 132 inside the Right Radar useEffect:
        //setLeftColorbar(`/api/imageData?file=2026/04/12/${leftRadar.toUpperCase()}/${productPrefix}/${leftRadar.toUpperCase()}_${productPrefix}_colorbar.png`);
        setLeftColorbar(radarProductToColorbar[leftRadarProduct]);
        setLeftUnit(radarProductToUnit[leftRadarProduct]);
        setLeftProductInfo('Individual radar visualization');
        setLeftProdDetails((prev) => ({
            ...prev,
            id: `xband_${productPrefix}`,
            name: leftRadarProduct,
        }));

        const controller = new AbortController();
        let url = `/api/xbandRadarImages?radarFolder=${encodeURIComponent(radarFolder)}&productPrefix=${encodeURIComponent(productPrefix)}`;
        if (XBAND_TEST_WINDOW) {
            url += `&testStart=${encodeURIComponent(XBAND_TEST_WINDOW.start)}&testEnd=${encodeURIComponent(XBAND_TEST_WINDOW.end)}`;
        }
        fetch(url, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                setLeftImages(Array.isArray(data.images) ? data.images : []);
                setLeftMeta(Array.isArray(data.meta) ? data.meta : []);
            })
            .catch((e) => {
                if (e?.name === 'AbortError') return;
                console.error('Failed to load left radar images', e);
                setLeftImages([]);
                setLeftMeta([]);
            });

        return () => controller.abort();
    }, [isIndividualRadarView, leftRadar, leftRadarProduct, xbandRefreshTick]);

    // Fetch right radar image sequence
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const radarFolder = radarCodeToFolder[rightRadar];
        const productPrefix = radarProductToPrefix[rightRadarProduct];
        // setRightColorbar(`/api/imageData?file=2026/04/12/${rightRadar.toUpperCase()}/${productPrefix}/${rightRadar.toUpperCase()}_${productPrefix}_colorbar.png`);
        setRightColorbar(radarProductToColorbar[rightRadarProduct]);
        setRightUnit(radarProductToUnit[rightRadarProduct]);
        setRightProductInfo('Individual radar visualization');
        setRightProdDetails((prev) => ({
            ...prev,
            id: `xband_${productPrefix}`,
            name: rightRadarProduct,
        }));

        const controller = new AbortController();
        let url = `/api/xbandRadarImages?radarFolder=${encodeURIComponent(radarFolder)}&productPrefix=${encodeURIComponent(productPrefix)}`;
        if (XBAND_TEST_WINDOW) {
            url += `&testStart=${encodeURIComponent(XBAND_TEST_WINDOW.start)}&testEnd=${encodeURIComponent(XBAND_TEST_WINDOW.end)}`;
        }
        fetch(url, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                setRightImages(Array.isArray(data.images) ? data.images : []);
                setRightMeta(Array.isArray(data.meta) ? data.meta : []);
            })
            .catch((e) => {
                if (e?.name === 'AbortError') return;
                console.error('Failed to load right radar images', e);
                setRightImages([]);
                setRightMeta([]);
            });

        return () => controller.abort();
    }, [isIndividualRadarView, rightRadar, rightRadarProduct, xbandRefreshTick]);

    // Show latest frame after images load
    useEffect(() => {
        if (!isIndividualRadarView) return;
        setLeftXbandIndex(leftImages.length > 0 ? leftImages.length - 1 : 0);
    }, [isIndividualRadarView, leftImages, leftRadar, leftRadarProduct, xbandRefreshTick]);

    useEffect(() => {
        if (!isIndividualRadarView) return;
        setRightXbandIndex(rightImages.length > 0 ? rightImages.length - 1 : 0);
    }, [isIndividualRadarView, rightImages, rightRadar, rightRadarProduct, xbandRefreshTick]);

    // Sync left panel metadata with current active frame
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const meta = leftMeta[leftXbandIndex];
        if (!meta) return;

        // Convert raw string date format from "2026-04-12" into a clean "12-APR-2026" display
        const dateParts = meta.date.split('-'); 
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${months[parseInt(dateParts[1]) - 1]}-${dateParts[0]}` : meta.date;

        setLeftProdDetails({
            id: `xband_${leftRadarProduct}`,
            name: `${leftRadarProduct.toUpperCase()}`, 
            day: `${meta.day.toUpperCase()} ${meta.time} Z`, // Combines day element and time clock into the card middle line
            date: formattedDate,                            // Places the clean calendar date string onto the bottom line
            time: '' 
        });
    }, [isIndividualRadarView, leftXbandIndex, leftMeta, leftRadarProduct, leftImages]);

    // Sync right panel metadata with current active frame
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const meta = rightMeta[rightXbandIndex];
        if (!meta) return;

        // Convert raw string date format from "2026-04-12" into a clean "12-APR-2026" display
        const dateParts = meta.date.split('-');
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${months[parseInt(dateParts[1]) - 1]}-${dateParts[0]}` : meta.date;

        setRightProdDetails({
            id: `xband_${rightRadarProduct}`,
            name: `${rightRadarProduct.toUpperCase()}`,
            day: `${meta.day.toUpperCase()} ${meta.time} Z`, // Combines day element and time clock into the card middle line
            date: formattedDate,                            // Places the clean calendar date string onto the bottom line
            time: ''
        });
    }, [isIndividualRadarView, leftXbandIndex, leftMeta, leftRadarProduct, leftImages]);

    // // Sync chip metadata with current frame
    // useEffect(() => {
    //     if (!isIndividualRadarView) return;
    //     const meta = leftMeta[leftXbandIndex];
    //     if (!meta) return;
    //     setLeftProdDetails((prev) => ({ ...prev, day: meta.day, date: meta.date, time: meta.time }));
    // }, [isIndividualRadarView, leftXbandIndex, leftMeta]);

    // useEffect(() => {
    //     if (!isIndividualRadarView) return;
    //     const meta = rightMeta[rightXbandIndex];
    //     if (!meta) return;
    //     setRightProdDetails((prev) => ({ ...prev, day: meta.day, date: meta.date, time: meta.time }));
    // }, [isIndividualRadarView, rightXbandIndex, rightMeta]);

    const handleProductChange = (product: string) => {
        if (product === 'individual_radar') {
            setIsIndividualRadarView(true);
            SetProdDetails({
                id: 'individual_radar',
                name: 'Individual Radars',
                day: '',
                date: '',
                time: '',
            });
            return;
        }
        setIsIndividualRadarView(false);

        if (product == 'radar_pr') {
            setproductPath(productImageDir.radarData.precip_rate);
            setColorbar(productImageDir.radarData.precip_rate.colorbar.in);
            setUnit(productImageDir.radarData.precip_rate.unit.in);
            currUnit.current = productImageDir.radarData.precip_rate.unit.in;
            setProductInfo(productImageDir.radarData.precip_rate.info);
        } else if (product == 'qpe_15min') {
            setproductPath(productImageDir.radarData.qpe_15min);
            setColorbar(productImageDir.radarData.qpe_15min.colorbar.in);
            setUnit(productImageDir.radarData.qpe_15min.unit.in);
            currUnit.current = productImageDir.radarData.qpe_15min.unit.in;
            setProductInfo(productImageDir.radarData.qpe_15min.info);
        } else if (product == 'qpe_1hr') {
            setproductPath(productImageDir.radarData.qpe_1hr);
            setColorbar(productImageDir.radarData.qpe_1hr.colorbar.in);
            setUnit(productImageDir.radarData.qpe_1hr.unit.in);
            currUnit.current = productImageDir.radarData.qpe_1hr.unit.in;
            setProductInfo(productImageDir.radarData.qpe_1hr.info);
        } else if (product == 'pr') {
            setproductPath(productImageDir.atmosphericForecast.precip_rate);
            setColorbar(productImageDir.atmosphericForecast.precip_rate.colorbar.in);
            setUnit(productImageDir.atmosphericForecast.precip_rate.unit.in);
            currUnit.current = productImageDir.atmosphericForecast.precip_rate.unit.in;
            setProductInfo(productImageDir.atmosphericForecast.precip_rate.info);
        } else if (product == 'tp') {
            setproductPath(productImageDir.atmosphericForecast.total_precip);
            setColorbar(productImageDir.atmosphericForecast.total_precip.colorbar.in);
            setUnit(productImageDir.atmosphericForecast.total_precip.unit.in);
            currUnit.current = productImageDir.atmosphericForecast.total_precip.unit.in;
            setProductInfo(productImageDir.atmosphericForecast.total_precip.info);
        } else if (product == 'comp_ref') {
            setproductPath(productImageDir.radarData.comp_ref);
            setColorbar(productImageDir.radarData.comp_ref.colorbar.dbz);
            setUnit(productImageDir.radarData.comp_ref.unit.dbz)
            currUnit.current = productImageDir.radarData.comp_ref.unit.dbz;
            setProductInfo(productImageDir.radarData.comp_ref.info);
        } else if (product == 'comp_now') {
            setproductPath(productImageDir.radarData.comp_now);
            setColorbar(productImageDir.radarData.comp_now.colorbar.dbz);
            setUnit(productImageDir.radarData.comp_now.unit.dbz)
            currUnit.current = productImageDir.radarData.comp_now.unit.dbz;
            setProductInfo(productImageDir.radarData.comp_now.info);
        } else if (product == 'temp') {
            setproductPath(productImageDir.atmosphericForecast.temp);
            setColorbar(productImageDir.atmosphericForecast.temp.colorbar.F);
            setUnit(productImageDir.atmosphericForecast.temp.unit.F)
            currUnit.current = productImageDir.atmosphericForecast.temp.unit.F;
            setProductInfo(productImageDir.atmosphericForecast.temp.info);
        }
    }

    const handleStepBackward = () => {
        if (isIndividualRadarView) {
            setLeftXbandIndex(0);
            setRightXbandIndex(0);
            return;
        }
        setCurrentIndex(0);
        SetProdDetails({
            ...prod_details,
            ['date']: selectedProduct['steps'][0]['date'],
            ['day']: selectedProduct['steps'][0]['day'],
            ['time']: selectedProduct['steps'][0]['time'],
        });
    }

    const handleStepForward = () => {
        if (isIndividualRadarView) {
            if (leftImages.length > 0) setLeftXbandIndex(leftImages.length - 1);
            if (rightImages.length > 0) setRightXbandIndex(rightImages.length - 1);
            return;
        }
        setCurrentIndex(images.length - 1);
        SetProdDetails({
            ...prod_details,
            ['date']: selectedProduct['steps'][images.length - 1]['date'],
            ['day']: selectedProduct['steps'][images.length - 1]['day'],
            ['time']: selectedProduct['steps'][images.length - 1]['time'],
        })
    }

    const handlePlayPause = () => {
        if (isPlaying) {
            if (intervalId) clearInterval(intervalId);
            setIsPlaying(false);
        } else {
            if (isIndividualRadarView) {
                if (leftImagesRef.current.length === 0 && rightImagesRef.current.length === 0) return;
                const id = setInterval(() => {
                    setLeftXbandIndex((prev) => {
                        const L = leftImagesRef.current.length;
                        if (L <= 0) return 0;
                        return prev < L - 1 ? prev + 1 : 0;
                    });
                    setRightXbandIndex((prev) => {
                        const L = rightImagesRef.current.length;
                        if (L <= 0) return 0;
                        return prev < L - 1 ? prev + 1 : 0;
                    });
                }, 700);
                setIntervalId(id);
                setIsPlaying(true);
                return;
            }
            if (images.length <= 0) return;
            const id = setInterval(() => {
                setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : 0));
            }, 700);
            setIntervalId(id);
            setIsPlaying(true);
        }
    };

    const handleBackward = () => {
        if (isIndividualRadarView) {
            setLeftXbandIndex((prev) => (prev > 0 ? prev - 1 : 0));
            setRightXbandIndex((prev) => (prev > 0 ? prev - 1 : 0));
            return;
        }
        setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
        SetProdDetails({
            ...prod_details,
            ['date']: selectedProduct['steps'][currentIndex]['date'],
            ['day']: selectedProduct['steps'][currentIndex]['day'],
            ['time']: selectedProduct['steps'][currentIndex]['time'],
        });
    }

    const handleForward = () => {
        if (isIndividualRadarView) {
            setLeftXbandIndex((prev) => {
                const L = leftImages.length;
                if (L <= 0) return 0;
                return prev < L - 1 ? prev + 1 : L - 1;
            });
            setRightXbandIndex((prev) => {
                const L = rightImages.length;
                if (L <= 0) return 0;
                return prev < L - 1 ? prev + 1 : L - 1;
            });
            return;
        }
        setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : images.length - 1));
        SetProdDetails({
            ...prod_details,
            ['date']: selectedProduct['steps'][currentIndex]['date'],
            ['day']: selectedProduct['steps'][currentIndex]['day'],
            ['time']: selectedProduct['steps'][currentIndex]['time'],
        });
    }

    const handleOpacityChange = (opacity: number) => {
        setOpacity(opacity);
    }

    const handleUnitChange = (selUnit: string, selProduct: string) => {
        let json_path = '';
        currUnit.current = selUnit
        if ([productImageDir.radarData.qpe_15min.id, productImageDir.radarData.qpe_1hr.id, productImageDir.atmosphericForecast.total_precip.id].includes(selProduct)) {
            setUnit(productPath.unit[selUnit]);
            setColorbar(productImageDir.radarData.qpe_15min.colorbar[selUnit]);
            json_path = productPath.details[selUnit]
        } else if (selProduct == productImageDir.radarData.precip_rate.id || selProduct == productImageDir.atmosphericForecast.precip_rate.id) {
            setUnit(productPath.unit[selUnit]);
            setColorbar(productImageDir.radarData.precip_rate.colorbar[selUnit]);
            json_path = productPath.details[selUnit]
        } else if (selProduct == productImageDir.atmosphericForecast.temp.id) {
            const temp_unt = (selUnit == productImageDir.atmosphericForecast.temp.unit.F) ? productImageDir.atmosphericForecast.temp.unit.F : 'DEG';
            setUnit(productPath.unit[temp_unt]);
            setColorbar(productImageDir.atmosphericForecast.temp.colorbar[temp_unt]);
            json_path = productPath.details[temp_unt]
        }
        fetchDetailsJSON(json_path);
    }

    useEffect(() => {
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [intervalId]);

    return (
        <div className="flex flex-col md:flex-row md:overflow-hidden lg:overflow-hidden">
            <div className="w-full md:w-64 2xl:w-[20rem] flex-none">
                <PublicSideNav
                    onStepBackward={handleStepBackward}
                    onBackward={handleBackward}
                    onPlayPause={handlePlayPause}
                    onForward={handleForward}
                    onStepForward={handleStepForward}
                    onProductChange={handleProductChange}
                    onOpacityChange={handleOpacityChange}
                    isPlaying={isPlaying}
                    prod_details={prod_details}
                />
            </div>
            <div className="h-screen flex grow w-screen">
                <main className='w-full h-screen'>
                    {isIndividualRadarView ? (
                        <div className="flex w-full h-full">
                            {/* Left radar panel */}
                            <div className="relative w-1/2 h-full">
                                <div className="absolute z-20 top-2 left-20 bg-theme_green/10 rounded-lg px-4 py-3 shadow-md border border-theme_green/30 space-y-2 text-xs">
                                    <div className="grid grid-cols-1 gap-2">
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Left Radar</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={leftRadar}
                                                onChange={(e) => setLeftRadar(e.target.value)}
                                            >
                                                <option value="FLOW">FLOW</option>
                                                <option value="KSOX">KSOX</option>
                                                <option value="KVTX">KVTX</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Left Product</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={leftRadarProduct}
                                                onChange={(e) => setLeftRadarProduct(e.target.value)}
                                            >
                                                <option value="Reflectivity">Reflectivity</option>
                                                <option value="Differential Reflectivity">Differential Reflectivity</option>
                                                <option value="Velocity">Velocity</option>
                                                <option value="PhiDP">PhiDP</option>
                                                {/*<option value="RhoHV">RhoHV</option>*/}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <Map
                                    mapId="map-left"
                                    radarCode={leftRadar}
                                    onUnitChange={handleUnitChange}
                                    images={leftImages}
                                    currentIndex={leftXbandIndex}
                                    prod_details={leftProdDetails}
                                    opacity={opacity}
                                    colorbar={leftColorbar}
                                    unit={leftUnit}
                                    productInfo={leftProductInfo}
                                />
                            </div>
                            {/* Right radar panel */}
                            <div className="relative w-1/2 h-full">
                                <div className="absolute z-20 top-2 left-20 bg-theme_green/10 rounded-lg px-4 py-3 shadow-md border border-theme_green/30 space-y-2 text-xs">
                                    <div className="grid grid-cols-1 gap-2">
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Right Radar</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={rightRadar}
                                                onChange={(e) => setRightRadar(e.target.value)}
                                            >
                                                <option value="FLOW">FLOW</option>
                                                <option value="KSOX">KSOX</option>
                                                <option value="KVTX">KVTX</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Right Product</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={rightRadarProduct}
                                                onChange={(e) => setRightRadarProduct(e.target.value)}
                                            >
                                                <option value="Reflectivity">Reflectivity</option>
                                                <option value="Differential Reflectivity">Differential Reflectivity</option>
                                                <option value="Velocity">Velocity</option>
                                                <option value="PhiDP">PhiDP</option>
                                                {/*<option value="RhoHV">RhoHV</option>*/}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <Map
                                    mapId="map-right"
                                    radarCode={rightRadar}
                                    onUnitChange={handleUnitChange}
                                    images={rightImages}
                                    currentIndex={rightXbandIndex}
                                    prod_details={rightProdDetails}
                                    opacity={opacity}
                                    colorbar={rightColorbar}
                                    unit={rightUnit}
                                    productInfo={rightProductInfo}
                                />
                            </div>
                        </div>
                    ) : (
                        <Map
                            mapId="map"
                            onUnitChange={handleUnitChange}
                            images={images}
                            currentIndex={currentIndex}
                            prod_details={prod_details}
                            opacity={opacity}
                            colorbar={colorbar}
                            unit={unit}
                            productInfo={productInfo}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
