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

type ProductStep = {
    imageName: string;
    day: string;
    date: string;
    time: string;
};

type ProductDetails = {
    product: string;
    steps: ProductStep[];
};

const historyProducts = [
    products.radarData.qpe_15min,
    products.radarData.qpe_1hr,
    products.radarData.pr,
    products.radarData.com_ref,
];

export default function Public() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [isIndividualRadarView, setIsIndividualRadarView] = useState(true);

    // Placeholder radar names — update folder keys to match actual XQPI radar folder names
    const [leftRadar, setLeftRadar] = useState('FLOW');
    const [leftRadarProduct, setLeftRadarProduct] = useState('Reflectivity');
    const [middleRadar, setMiddleRadar] = useState('KVTX');
    const [middleRadarProduct, setMiddleRadarProduct] = useState('Reflectivity');
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
    const [middleImages, setMiddleImages] = useState<string[]>([]);
    const [rightImages, setRightImages] = useState<string[]>([]);
    const [leftMeta, setLeftMeta] = useState<Array<{ timestamp: string; date: string; day: string; time: string }>>([]);
    const [middleMeta, setMiddleMeta] = useState<Array<{ timestamp: string; date: string; day: string; time: string }>>([]);
    const [rightMeta, setRightMeta] = useState<Array<{ timestamp: string; date: string; day: string; time: string }>>([]);

    const [leftColorbar, setLeftColorbar] = useState('');
    const [middleColorbar, setMiddleColorbar] = useState('');
    const [rightColorbar, setRightColorbar] = useState('');
    const [leftUnit, setLeftUnit] = useState('');
    const [middleUnit, setMiddleUnit] = useState('');
    const [rightUnit, setRightUnit] = useState('');
    const [leftProductInfo, setLeftProductInfo] = useState('');
    const [middleProductInfo, setMiddleProductInfo] = useState('');
    const [rightProductInfo, setRightProductInfo] = useState('');
    const [leftProdDetails, setLeftProdDetails] = useState<XBandProdDetails>({
        id: '',
        name: 'Reflectivity',
        day: '',
        date: '',
        time: '',
    });
    const [middleProdDetails, setMiddleProdDetails] = useState<XBandProdDetails>({
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
    const [flowDate, setFlowDate] = useState('');
    const [flowLoading, setFlowLoading] = useState(false);
    const [flowError, setFlowError] = useState('');
    const historicalFlow = leftRadar === 'FLOW' && flowDate !== '';
    const leftRefreshTick = historicalFlow ? 0 : xbandRefreshTick;
    const [leftXbandIndex, setLeftXbandIndex] = useState(0);
    const [middleXbandIndex, setMiddleXbandIndex] = useState(0);
    const [rightXbandIndex, setRightXbandIndex] = useState(0);
    const leftImagesRef = useRef<string[]>([]);
    const middleImagesRef = useRef<string[]>([]);
    const rightImagesRef = useRef<string[]>([]);
    leftImagesRef.current = leftImages;
    middleImagesRef.current = middleImages;
    rightImagesRef.current = rightImages;

    const [unit, setUnit] = useState(units.in)
    const [productPath, setproductPath] = useState(productImageDir.atmosphericForecast.total_precip);
    const [opacity, setOpacity] = useState(1);
    const [colorbar, setColorbar] = useState(productImageDir.atmosphericForecast.total_precip.colorbar.in);
    const [productInfo, setProductInfo] = useState(productImageDir.atmosphericForecast.total_precip.info);
    const [productDate, setProductDate] = useState('');
    const [productResult, setProductResult] = useState<{
        path: string;
        details: ProductDetails | null;
        images: string[];
        error: string;
    } | null>(null);
    const supportsHistory = historyProducts.includes(productPath.id);
    const historicalProduct = supportsHistory && productDate !== '';
    const usesRainfallUnits = [
        products.radarData.qpe_15min, products.radarData.qpe_1hr, products.radarData.pr,
        products.forecast.pr, products.forecast.tp,
    ].includes(productPath.id);
    const isTemperature = productPath.id === products.forecast.temp;
    const unitFolder = usesRainfallUnits ? unit.split('/')[0] : '';
    const temperatureKey = unit === units.F ? 'F' : 'DEG';
    const liveDetailsPath = typeof productPath.details === 'string'
        ? productPath.details
        : productPath.details[isTemperature ? temperatureKey : unitFolder];
    const liveImagesPath = productPath.images + (
        isTemperature ? (temperatureKey === 'F' ? 'F/' : 'Deg/') : unitFolder ? unitFolder + '/' : ''
    );
    const imagesPath = historicalProduct ? liveImagesPath + productDate.replace(/-/g, '/') + '/' : liveImagesPath;
    const detailsPath = historicalProduct ? imagesPath + 'details.json' : liveDetailsPath;
    const startAtFirstFrame = historicalProduct || [
        products.radarData.com_nowcast, products.forecast.pr, products.forecast.tp, products.forecast.temp,
    ].includes(productPath.id);

    const activeProduct = productResult?.path === detailsPath ? productResult : null;
    const images = activeProduct?.images ?? [];
    const productFrame = activeProduct?.details?.steps[currentIndex];
    const prod_details = {
        id: isIndividualRadarView ? 'individual_radar' : productPath.id,
        name: isIndividualRadarView ? 'Individual Radars' : activeProduct?.details?.product ?? '',
        day: productFrame?.day ?? '',
        date: productFrame?.date ?? '',
        time: productFrame?.time ?? '',
    };

    useEffect(() => {
        if (isIndividualRadarView || !detailsPath) return;

        const controller = new AbortController();
        setProductResult(null);
        setCurrentIndex(0);

        async function loadProduct() {
            try {
                const response = await fetch(detailsPath, { signal: controller.signal, cache: 'no-store' });
                if (!response.ok && !(historicalProduct && response.status === 404)) {
                    throw new Error(`Image metadata request returned ${response.status}`);
                }
                const details: ProductDetails | null = response.ok ? await response.json() : null;
                if (details && !Array.isArray(details.steps)) {
                    throw new Error('Image metadata has no steps array');
                }
                if (historicalProduct && details) {
                    // Archive filenames end in YYYYMMDD_HHMMSS.png.
                    details.steps = [...details.steps].sort((a, b) =>
                        a.imageName.slice(-19).localeCompare(b.imageName.slice(-19))
                    );
                }
                const frames = details?.steps.map((step) => imagesPath + step.imageName) ?? [];
                if (controller.signal.aborted) return;
                setCurrentIndex(startAtFirstFrame ? 0 : Math.max(frames.length - 1, 0));
                setProductResult({ path: detailsPath, details, images: frames, error: '' });
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Error fetching product images:', error);
                setProductResult({ path: detailsPath, details: null, images: [], error: 'Could not load images.' });
            }
        }

        void loadProduct();
        return () => controller.abort();
    }, [detailsPath, imagesPath, isIndividualRadarView, historicalProduct, startAtFirstFrame]);

    useEffect(() => {
        if (isIndividualRadarView) return;
        if (intervalId) clearInterval(intervalId);
        setIsPlaying(false);
        if (!historicalProduct || !activeProduct || activeProduct.images.length < 2) return;

        const frameCount = activeProduct.images.length;
        const id = setInterval(() => {
            setCurrentIndex((previous) => (previous + 1) % frameCount);
        }, 700);
        setIntervalId(id);
        setIsPlaying(true);
        return () => clearInterval(id);
    }, [isIndividualRadarView, historicalProduct, detailsPath, activeProduct]);

    // Stop animation when switching to/from individual radar view or changing radar selection
    useEffect(() => {
        if (!isIndividualRadarView) return;
        if (intervalId) clearInterval(intervalId);
        setIsPlaying(false);
    }, [isIndividualRadarView, leftRadar, leftRadarProduct, rightRadar, rightRadarProduct, middleRadar, middleRadarProduct, flowDate]);

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
        let cancelled = false;

        setFlowLoading(true);
        setFlowError('');
        setLeftImages([]);
        setLeftMeta([]);
        setLeftProdDetails((previous) => ({
            ...previous, day: '', date: '', time: '',
        }));

        let url = `/api/xbandRadarImages?radarFolder=${encodeURIComponent(radarFolder)}&productPrefix=${encodeURIComponent(productPrefix)}`;

        if (historicalFlow) {
            const day = flowDate.replace(/-/g, '');
            url += `&testStart=${day}-000000&testEnd=${day}-235959`;
        } else if (XBAND_TEST_WINDOW) {
            url += `&testStart=${encodeURIComponent(XBAND_TEST_WINDOW.start)}&testEnd=${encodeURIComponent(XBAND_TEST_WINDOW.end)}`;
        }

        fetch(url, { signal: controller.signal, cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Image request failed: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (cancelled) return;
                setLeftImages(Array.isArray(data.images) ? data.images : []);
                setLeftMeta(Array.isArray(data.meta) ? data.meta : []);
            })
            .catch((error) => {
                if (cancelled || error?.name === 'AbortError') return;
                console.error('Failed to load FLOW images', error);
                setFlowError('Unable to load radar images.');
            })
            .finally(() => {
                if (!cancelled) setFlowLoading(false);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        isIndividualRadarView,
        leftRadar,
        leftRadarProduct,
        flowDate,
        leftRefreshTick,
    ]);

    // Fetch middle radar image sequence
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const radarFolder = radarCodeToFolder[middleRadar];
        const productPrefix = radarProductToPrefix[middleRadarProduct];
        // Look for this block around Line 132 inside the Right Radar useEffect:
        //setMiddleColorbar(`/api/imageData?file=2026/04/12/${middleRadar.toUpperCase()}/${productPrefix}/${middleRadar.toUpperCase()}_${productPrefix}_colorbar.png`);
        setMiddleColorbar(radarProductToColorbar[middleRadarProduct]);
        setMiddleUnit(radarProductToUnit[middleRadarProduct]);
        setMiddleProductInfo('Individual radar visualization');
        setMiddleProdDetails((prev) => ({
            ...prev,
            id: `xband_${productPrefix}`,
            name: middleRadarProduct,
        }));

        const controller = new AbortController();
        let url = `/api/xbandRadarImages?radarFolder=${encodeURIComponent(radarFolder)}&productPrefix=${encodeURIComponent(productPrefix)}`;
        if (XBAND_TEST_WINDOW) {
            url += `&testStart=${encodeURIComponent(XBAND_TEST_WINDOW.start)}&testEnd=${encodeURIComponent(XBAND_TEST_WINDOW.end)}`;
        }
        fetch(url, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                setMiddleImages(Array.isArray(data.images) ? data.images : []);
                setMiddleMeta(Array.isArray(data.meta) ? data.meta : []);
            })
            .catch((e) => {
                if (e?.name === 'AbortError') return;
                console.error('Failed to load middle radar images', e);
                setMiddleImages([]);
                setMiddleMeta([]);
            });

        return () => controller.abort();
    }, [isIndividualRadarView, middleRadar, middleRadarProduct, xbandRefreshTick]);

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
        setLeftXbandIndex(
            historicalFlow ? 0 : Math.max(leftImages.length - 1, 0)
        );
    }, [isIndividualRadarView, leftImages, historicalFlow]);

    useEffect(() => {
        if (!isIndividualRadarView) return;
        setMiddleXbandIndex(middleImages.length > 0 ? middleImages.length - 1 : 0);
    }, [isIndividualRadarView, middleImages, middleRadar, middleRadarProduct, xbandRefreshTick]);

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

    // Sync middle panel metadata with current active frame
    useEffect(() => {
        if (!isIndividualRadarView) return;
        const meta = middleMeta[middleXbandIndex];
        if (!meta) return;

        // Convert raw string date format from "2026-04-12" into a clean "12-APR-2026" display
        const dateParts = meta.date.split('-');
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${months[parseInt(dateParts[1]) - 1]}-${dateParts[0]}` : meta.date;

        setMiddleProdDetails({
            id: `xband_${middleRadarProduct}`,
            name: `${middleRadarProduct.toUpperCase()}`,
            day: `${meta.day.toUpperCase()} ${meta.time} Z`, // Combines day element and time clock into the card middle line
            date: formattedDate,                            // Places the clean calendar date string onto the bottom line
            time: ''
        });
    }, [isIndividualRadarView, middleXbandIndex, middleMeta, middleRadarProduct, middleImages]);

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
    }, [isIndividualRadarView, rightXbandIndex, rightMeta, rightRadarProduct, rightImages]);

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
            return;
        }
        setIsIndividualRadarView(false);

        if (product == 'radar_pr') {
            setproductPath(productImageDir.radarData.precip_rate);
            setColorbar(productImageDir.radarData.precip_rate.colorbar.in);
            setUnit(productImageDir.radarData.precip_rate.unit.in);
            setProductInfo(productImageDir.radarData.precip_rate.info);
        } else if (product == 'qpe_15min') {
            setproductPath(productImageDir.radarData.qpe_15min);
            setColorbar(productImageDir.radarData.qpe_15min.colorbar.in);
            setUnit(productImageDir.radarData.qpe_15min.unit.in);
            setProductInfo(productImageDir.radarData.qpe_15min.info);
        } else if (product == 'qpe_1hr') {
            setproductPath(productImageDir.radarData.qpe_1hr);
            setColorbar(productImageDir.radarData.qpe_1hr.colorbar.in);
            setUnit(productImageDir.radarData.qpe_1hr.unit.in);
            setProductInfo(productImageDir.radarData.qpe_1hr.info);
        } else if (product == 'pr') {
            setproductPath(productImageDir.atmosphericForecast.precip_rate);
            setColorbar(productImageDir.atmosphericForecast.precip_rate.colorbar.in);
            setUnit(productImageDir.atmosphericForecast.precip_rate.unit.in);
            setProductInfo(productImageDir.atmosphericForecast.precip_rate.info);
        } else if (product == 'tp') {
            setproductPath(productImageDir.atmosphericForecast.total_precip);
            setColorbar(productImageDir.atmosphericForecast.total_precip.colorbar.in);
            setUnit(productImageDir.atmosphericForecast.total_precip.unit.in);
            setProductInfo(productImageDir.atmosphericForecast.total_precip.info);
        } else if (product == 'comp_ref') {
            setproductPath(productImageDir.radarData.comp_ref);
            setColorbar(productImageDir.radarData.comp_ref.colorbar.dbz);
            setUnit(productImageDir.radarData.comp_ref.unit.dbz)
            setProductInfo(productImageDir.radarData.comp_ref.info);
        } else if (product == 'comp_now') {
            setproductPath(productImageDir.radarData.comp_now);
            setColorbar(productImageDir.radarData.comp_now.colorbar.dbz);
            setUnit(productImageDir.radarData.comp_now.unit.dbz)
            setProductInfo(productImageDir.radarData.comp_now.info);
        } else if (product == 'temp') {
            setproductPath(productImageDir.atmosphericForecast.temp);
            setColorbar(productImageDir.atmosphericForecast.temp.colorbar.F);
            setUnit(productImageDir.atmosphericForecast.temp.unit.F)
            setProductInfo(productImageDir.atmosphericForecast.temp.info);
        }
    }

    const handleStepBackward = () => {
        // FLOW history disables the other panels
        if (isIndividualRadarView && historicalFlow) {
            setLeftXbandIndex(0);
            return;
        }

        if (isIndividualRadarView) {
            setLeftXbandIndex(0);
            setMiddleXbandIndex(0);
            setRightXbandIndex(0);
            return;
        }
        setCurrentIndex(0);
    }

    const handleStepForward = () => {
        // FLOW history disables the other panels
        if (isIndividualRadarView && historicalFlow) {
            
            setLeftXbandIndex(Math.max(leftImages.length - 1, 0));
            return;
        }

        if (isIndividualRadarView) {
            if (leftImages.length > 0) setLeftXbandIndex(leftImages.length - 1);
            if (middleImages.length > 0) setMiddleXbandIndex(middleImages.length - 1);
            if (rightImages.length > 0) setRightXbandIndex(rightImages.length - 1);
            return;
        }
        setCurrentIndex(Math.max(images.length - 1, 0));
    }

    const handlePlayPause = () => {
        // FLOW history disables the other panels
        if (isIndividualRadarView && historicalFlow) {
            
            if (isPlaying) {
                if (intervalId) clearInterval(intervalId);
                setIsPlaying(false);
            } else {
                if (leftImagesRef.current.length === 0) return;
                const id = setInterval(() => {
                    setLeftXbandIndex((previous) => {
                        const count = leftImagesRef.current.length;
                        return count > 0 ? (previous + 1) % count : 0;
                    });
                }, 700);
                setIntervalId(id);
                setIsPlaying(true);
            }
            return;
        }

        if (isPlaying) {
            if (intervalId) clearInterval(intervalId);
            setIsPlaying(false);
        } else {
            if (isIndividualRadarView) {
                if (leftImagesRef.current.length === 0 && middleImagesRef.current.length === 0 && rightImagesRef.current.length === 0) return;
                const id = setInterval(() => {
                    setLeftXbandIndex((prev) => {
                        const L = leftImagesRef.current.length;
                        if (L <= 0) return 0;
                        return prev < L - 1 ? prev + 1 : 0;
                    });
                    setMiddleXbandIndex((prev) => {
                        const L = middleImagesRef.current.length;
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
        // FLOW history disables the other panels
        if (isIndividualRadarView && historicalFlow) {
            
            setLeftXbandIndex((previous) => Math.max(previous - 1, 0));
            return;
        }

        if (isIndividualRadarView) {
            setLeftXbandIndex((prev) => (prev > 0 ? prev - 1 : 0));
            setMiddleXbandIndex((prev) => (prev > 0 ? prev - 1 : 0));
            setRightXbandIndex((prev) => (prev > 0 ? prev - 1 : 0));
            return;
        }
        setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
    }

    const handleForward = () => {
        // FLOW history disables the other panels
        if (isIndividualRadarView && historicalFlow) {
            
            setLeftXbandIndex((previous) =>
                Math.min(previous + 1, Math.max(leftImages.length - 1, 0))
            );
            return;
        }

        if (isIndividualRadarView) {
            setLeftXbandIndex((prev) => {
                const L = leftImages.length;
                if (L <= 0) return 0;
                return prev < L - 1 ? prev + 1 : L - 1;
            });
            setMiddleXbandIndex((prev) => {
                const L = middleImages.length;
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
        setCurrentIndex((previous) => Math.min(previous + 1, Math.max(images.length - 1, 0)));
    }

    const handleOpacityChange = (opacity: number) => {
        setOpacity(opacity);
    }

    const handleUnitChange = (selUnit: string, selProduct: string) => {
        if ([productImageDir.radarData.qpe_15min.id, productImageDir.radarData.qpe_1hr.id, productImageDir.atmosphericForecast.total_precip.id].includes(selProduct)) {
            setUnit(productPath.unit[selUnit]);
            setColorbar(productImageDir.radarData.qpe_15min.colorbar[selUnit]);
        } else if (selProduct == productImageDir.radarData.precip_rate.id || selProduct == productImageDir.atmosphericForecast.precip_rate.id) {
            setUnit(productPath.unit[selUnit]);
            setColorbar(productImageDir.radarData.precip_rate.colorbar[selUnit]);
        } else if (selProduct == productImageDir.atmosphericForecast.temp.id) {
            const temp_unt = (selUnit == productImageDir.atmosphericForecast.temp.unit.F) ? productImageDir.atmosphericForecast.temp.unit.F : 'DEG';
            setUnit(productPath.unit[temp_unt]);
            setColorbar(productImageDir.atmosphericForecast.temp.colorbar[temp_unt]);
        }
    }

    useEffect(() => {
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [intervalId]);


    // Start the selected FLOW day automatically.
    useEffect(() => {
        if (!isIndividualRadarView || !historicalFlow) return;
        setIsPlaying(false);
        if (leftImages.length === 0) return;

        const id = setInterval(() => {
            setLeftXbandIndex((previous) =>
                (previous + 1) % leftImages.length
            );
        }, 700);

        setIntervalId(id);
        setIsPlaying(true);
        return () => clearInterval(id);
    }, [isIndividualRadarView, historicalFlow, leftImages]);

    return (
        <div className="w-screen flex-none w-screen flex-none flex flex-col md:flex-row md:overflow-hidden lg:overflow-hidden">
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
            <div className="h-screen flex flex-1 w-full min-w-0">
                <main className='w-full h-screen'>
                    {isIndividualRadarView ? (
                        <div className="flex w-full h-full">
                            {/* Left radar panel */}
                            <div className={`relative min-w-0 h-full ${historicalFlow ? "w-full" : "w-1/3"}`}>
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

                                        {leftRadar === 'FLOW' && (
                                            <div>
                                                <label
                                                    htmlFor="flow-date"
                                                    className="block font-semibold text-gray-800 mb-1"
                                                >
                                                    Historical date (UTC)
                                                </label>
                                                <input
                                                    id="flow-date"
                                                    type="date"
                                                    value={flowDate}
                                                    onChange={(event) => setFlowDate(event.target.value)}
                                                    className="w-full border border-gray-300 rounded-md px-2 py-1 bg-white"
                                                />
                                                {flowDate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFlowDate('')}
                                                        className="mt-2 underline"
                                                    >
                                                        Return to live
                                                    </button>
                                                )}
                                                <p role="status" className="mt-1">
                                                    {flowLoading
                                                        ? 'Loading…'
                                                        : flowError
                                                            ? flowError
                                                            : leftImages.length === 0
                                                                ? 'No data available'
                                                                : `${leftImages.length} frames`}
                                                </p>
                                            </div>
                                        )}
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
                            {/* Middle radar panel */}
                            <div className={`relative w-1/3 min-w-0 h-full ${historicalFlow ? "hidden" : ""}`}>
                                {historicalFlow ? (
                                    <div
                                        role="status"
                                        className="flex h-full items-center justify-center bg-gray-100 px-6 text-center text-gray-600"
                                    >
                                        <div>
                                            <p className="font-semibold">Panel disabled</p>
                                            <p className="mt-2">
                                                Disabled while viewing FLOW history.
                                            </p>
                                            <p className="mt-2">
                                                Select Return to live to enable it.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>

                                <div className="absolute z-20 top-2 left-20 bg-theme_green/10 rounded-lg px-4 py-3 shadow-md border border-theme_green/30 space-y-2 text-xs">
                                    <div className="grid grid-cols-1 gap-2">
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Middle Radar</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={middleRadar}
                                                onChange={(e) => setMiddleRadar(e.target.value)}
                                            >
                                                <option value="FLOW">FLOW</option>
                                                <option value="KSOX">KSOX</option>
                                                <option value="KVTX">KVTX</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span className="block font-semibold text-gray-800 mb-1">Middle Product</span>
                                            <select
                                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-theme_green focus:border-theme_green bg-white"
                                                value={middleRadarProduct}
                                                onChange={(e) => setMiddleRadarProduct(e.target.value)}
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
                                    mapId="map-middle"
                                    radarCode={middleRadar}
                                    onUnitChange={handleUnitChange}
                                    images={middleImages}
                                    currentIndex={middleXbandIndex}
                                    prod_details={middleProdDetails}
                                    opacity={opacity}
                                    colorbar={middleColorbar}
                                    unit={middleUnit}
                                    productInfo={middleProductInfo}
                                />

                                    </>
                                )}
                            </div>
                            {/* Right radar panel */}
                            <div className={`relative w-1/3 min-w-0 h-full ${historicalFlow ? "hidden" : ""}`}>
                                {historicalFlow ? (
                                    <div
                                        role="status"
                                        className="flex h-full items-center justify-center bg-gray-100 px-6 text-center text-gray-600"
                                    >
                                        <div>
                                            <p className="font-semibold">Panel disabled</p>
                                            <p className="mt-2">
                                                Disabled while viewing FLOW history.
                                            </p>
                                            <p className="mt-2">
                                                Select Return to live to enable it.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>

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

                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-full w-full">
                            {supportsHistory && (
                                <div className="absolute z-20 top-2 left-20 rounded-lg bg-white px-4 py-3 shadow-md border border-theme_green/30 text-xs">
                                    <label htmlFor="product-date" className="block font-semibold text-gray-800 mb-1">
                                        Historical date (UTC)
                                    </label>
                                    <input
                                        id="product-date"
                                        type="date"
                                        value={productDate}
                                        onChange={(event) => setProductDate(event.target.value)}
                                        className="block rounded-md border border-gray-300 px-2 py-1"
                                    />
                                    {historicalProduct && (
                                        <>
                                            <button type="button" onClick={() => setProductDate('')} className="mt-2 underline">
                                                Return to live
                                            </button>
                                            <p role="status" className="mt-1">
                                                {!activeProduct ? 'Loading…' : activeProduct.error ||
                                                    (images.length ? `${images.length} frames` : 'No archived images for this date.')}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
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
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
