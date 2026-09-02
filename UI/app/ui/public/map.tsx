'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useEffect, useRef } from 'react';
import Map from "ol/Map";
import View from "ol/View";
import Circle from 'ol/geom/Circle.js';
import Feature from 'ol/Feature.js';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { Tile as TileLayer, Vector as VectorLayer, Image as ImageLayer } from 'ol/layer.js';
import { Circle as CircleStyle, Fill, Stroke, Style, Icon, Text } from 'ol/style.js';
import { click } from 'ol/events/condition.js';
import { transformExtent, fromLonLat, Projection, transform, getPointResolution } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON.js';
import "react-toastify/dist/ReactToastify.css";
import "ol/ol.css";
import { ImageStatic } from 'ol/source';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import Papa from "papaparse";
import Overlay from "ol/Overlay";
import Point from "ol/geom/Point.js";

import {
    epsgLookupMapTiler,
    fromEPSGCode,
    register,
    setEPSGLookup,
} from 'ol/proj/proj4.js';
import { getCenter } from 'ol/extent.js';
import proj4 from 'proj4';
import { fromUrl, fromArrayBuffer } from 'geotiff';
import { ScaleLine } from 'ol/control.js';
import { FitOptions } from "ol/View"
import {
    Popover,
    PopoverHandler,
    PopoverContent,
    Button,
} from "@material-tailwind/react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { Chip } from "@material-tailwind/react";
import { get as getProjection } from 'ol/proj.js';
import GeoTIFFSource from 'ol/source/GeoTIFF';
import { units } from '../../constants';
import { products } from '../../constants';

type ProdDetails = {
    id: string;
    name: string;
    day?: string;
    time?: string;
    date?: string;
};

const radarConfigs: Record<string, { lat: number; lon: number; range: number }> = {
    // Placeholder radar coordinates — update with actual XQPI radar locations
    FLOW: { lat: 34.2048, lon: -118.1708, range: 40000 },
    KSOX: { lat: 33.817733, lon: -117.636, range: 40000 },
    KVTX: { lat: 34.412017, lon: -119.17875, range: 40000 },
};

function computeRadarExtentLonLat(radar: { lat: number; lon: number; range: number }): [number, number, number, number] {
    const earthRadiusMeters = 6371000;
    const latRad = radar.lat * (Math.PI / 180);
    const dLatDeg = (radar.range / earthRadiusMeters) * (180 / Math.PI);
    const dLonDeg = (radar.range / (earthRadiusMeters * Math.cos(latRad))) * (180 / Math.PI);
    return [radar.lon - dLonDeg, radar.lat - dLatDeg, radar.lon + dLonDeg, radar.lat + dLatDeg];
}

function scaleExtent3857Inward(extent: number[], factor: number): number[] {
    const [minX, minY, maxX, maxY] = extent;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const halfW = ((maxX - minX) / 2) * factor;
    const halfH = ((maxY - minY) / 2) * factor;
    return [cx - halfW, cy - halfH, cx + halfW, cy + halfH];
}

const INDIVIDUAL_RADAR_FIT_EXTENT_FACTOR = 1.3;
const INDIVIDUAL_RADAR_FIT_PADDING = [6, 6, 6, 6] as const;

const radarElevationMap: Record<string, number> = {
    FLOW: 3.5,
    KSOX: 0.5,
    KVTX: 0.5,
};

export default function Mapcomponent({
    mapId = "map",
    radarCode,
    onUnitChange,
    images,
    currentIndex,
    prod_details,
    opacity,
    colorbar,
    unit,
    productInfo,
}: {
    mapId?: string;
    radarCode?: string;
    onUnitChange: (seUnit: string, selProduct: string) => void;
    images: string[];
    currentIndex: number;
    prod_details: ProdDetails;
    opacity: number;
    colorbar: string;
    unit: string;
    productInfo: string;
}) {
    const mapRef: any = useRef(null);
    const sourceRef: any = useRef(null);
    const layerRef: any = useRef(null);
    const selectRef: any = useRef(null);
    const [preloadedImages, setPreloadedImages] = useState([]);
    const [layers, setLayers] = useState([]);
    const [isSetup, setIsSetup] = useState(false);
    const rangeRingLayerRef: any = useRef(null);
    const radarElevation = radarCode ? radarElevationMap[radarCode] : undefined;

    const rainfall_units = [products.radarData.qpe_15min, products.radarData.qpe_1hr, products.radarData.pr,
    products.forecast.pr, products.forecast.tp];
    const imageExtent: any = [-124.005, 36.500, -121.195, 39.505];

    let baseLayer: any = new TileLayer({
        source: new OSM()
    });
    baseLayer.set('id', 'baseLayer');

    proj4.defs(
        'EPSG:32610',
        '+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs'
    );
    register(proj4);

    useEffect(() => {
            const preloadImages = async () => {
                if (!images || images.length === 0) {
                    setPreloadedImages([]);
                    return;
                }

                const isXBand = typeof prod_details?.id === 'string' && prod_details.id.startsWith('xband_');
                let extent: any = imageExtent;
                if (isXBand && radarCode && radarConfigs[radarCode]) {
                    extent = computeRadarExtentLonLat(radarConfigs[radarCode]);
                }

                const extent3857 = transformExtent(extent, 'EPSG:4326', 'EPSG:3857');

                const preloaded = await Promise.all(images.map(async (item: any) => {
                    if (!item) return null;

                    // 1. Safely extract the file path string whether item is an object or a plain string
                    const filePath = typeof item === 'object' ? item.relPathFromChivoRoot : item;
                    
                    if (!filePath) return null;

                    // 2. Direct it through our imageData API proxy route
                    // Handles both '2026/04/12...' paths and older 'xband_chivo/...' structures
                    const needsProxy = filePath.startsWith('2026/') || filePath.startsWith('xband_chivo/');
                    const resolvedUrl = needsProxy
                        ? `/api/imageData?file=${encodeURIComponent(filePath)}&t=${Date.now()}`
                        : filePath;

                    return new ImageStatic({
                        url: resolvedUrl,
                        projection: 'EPSG:3857', 
                        imageExtent: extent3857,
                    });
                }));

                // Filter out any null entries from failed items safely
                setPreloadedImages(preloaded.filter(Boolean));
            };
            preloadImages();
        }, [images, radarCode, prod_details?.id]);

    useEffect(() => {
        if (layerRef.current) {
            layerRef.current.setOpacity(opacity);
        }
    }, [opacity]);

    useEffect(() => {
        layerRef.current = new ImageLayer({
            visible: true,
            opacity: 1,
        });
        layerRef.current.set('id', 'imageLayer');

        mapRef.current = new Map({
            target: mapId,
            layers: [baseLayer, layerRef.current],
            view: new View({
                center: [-13610058.982783515, 4561655.27023881],
                zoom: 7.5,
            }),
        });

        rangeRingLayerRef.current = new VectorLayer({
            source: new VectorSource(),
            zIndex: 10,
        });
        mapRef.current.addLayer(rangeRingLayerRef.current);

        return () => {
            mapRef.current.setTarget(undefined);
        };
    }, [mapId]);

    useEffect(() => {
        if (layerRef.current) {
            if (!images || images.length === 0) {
                layerRef.current.setSource(null);
            } else if (preloadedImages.length > 0) {
                layerRef.current.setSource(preloadedImages[currentIndex]);
            }
        }
    }, [currentIndex, images, preloadedImages]);

    // Range ring + auto-zoom for individual radar view
    useEffect(() => {
        if (!mapRef.current || !rangeRingLayerRef.current) return;

        const radar = radarCode ? radarConfigs[radarCode] : null;
        const source: VectorSource = rangeRingLayerRef.current.getSource();
        source.clear();

        if (!radar) return;

        const center = fromLonLat([radar.lon, radar.lat]);
        const resolution = getPointResolution('EPSG:3857', 1, center);
        const radius = radar.range / (resolution || 1);

        const feature = new Feature({
            geometry: new Circle(center, radius),
        });
        feature.setStyle(
            new Style({
                stroke: new Stroke({ color: '#9a9a9a', width: 3 }),
            })
        );
        source.addFeature(feature);

        const isXBand = typeof prod_details?.id === 'string' && prod_details.id.startsWith('xband_');
        if (isXBand && radarCode && radarConfigs[radarCode]) {
            const extentLonLat = computeRadarExtentLonLat(radarConfigs[radarCode]);
            const extent3857 = transformExtent(extentLonLat, 'EPSG:4326', 'EPSG:3857');
            const fitExtent = scaleExtent3857Inward(extent3857, INDIVIDUAL_RADAR_FIT_EXTENT_FACTOR);
            const view = mapRef.current.getView();
            const size = mapRef.current.getSize?.();
            if (size && size[0] > 0 && size[1] > 0) {
                requestAnimationFrame(() => {
                    view.fit(fitExtent, {
                        padding: [...INDIVIDUAL_RADAR_FIT_PADDING],
                        duration: 0,
                        maxZoom: 18,
                    });
                });
            }
        }
    }, [radarCode, prod_details?.id]);

    // Initialize clean tracking variables for fallback filename parsing
    let displayDay = '';
    let displayDate = '';
    let displayTime = '';

    let currentItem = '';
    if (images && images[currentIndex]) {
        const item = images[currentIndex];
        if (typeof item === 'object' && item !== null) {
            currentItem = item.relPathFromChivoRoot || item.filePath || '';
        } else if (typeof item === 'string') {
            currentItem = item;
        }
    }

    if (currentItem) {
        try {
            const pathParts = currentItem.split('/');
            const fileName = pathParts[pathParts.length - 1];

            const timeMatch = fileName.match(/(\d{2})(\d{2})(\d{2})/);
            if (timeMatch) {
                displayTime = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
            }

            if (pathParts.length >= 4) {
                const year = pathParts[0];  
                const month = pathParts[1]; 
                const day = pathParts[2];   
                
                const dateObj = new Date(`${year}-${month}-${day}T00:00:00Z`);
                if (!isNaN(dateObj.getTime())) {
                    displayDay = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
                    displayDate = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                        .toUpperCase().replace(/ /g, '-').replace(/,/g, '');
                }
            }
        } catch (e) {
            console.error("Error parsing radar filename metadata:", e);
        }
    }

    return (
        <div className='overflow-hidden relative w-full h-full'>
            <Popover placement="right">
                <PopoverHandler>
                    <Button className='!absolute rounded-2xl top-[20px] left-[40px] z-10 bg-theme_green bg-none p-0'>
                        <FontAwesomeIcon className='bg-none text-white' icon={faCircleInfo} size="2x" color="white" />
                    </Button>
                </PopoverHandler>
                <PopoverContent className='fixed z-20 p-1 text-white bg-theme_green leading-4'>
                    {productInfo}
                </PopoverContent>
            </Popover>

            {rainfall_units.includes(prod_details['id']) && (
                <div className='flex gap-0 bg-white absolute z-10 top-[1rem] right-5 sm:top-[0.8rem] sm:right-[0.5rem] md:top-[1rem] md:right-[0.5rem]'>
                    <button onClick={() => onUnitChange(units.in, prod_details['id'])} className='bg-transparent border-none cursor-pointer'>
                        <Chip variant={(unit === units.in || unit === units.in_per_hr) ? "filled" : "outlined"} size='md' value="in" />
                    </button>
                    <button onClick={() => onUnitChange(units.mm, prod_details['id'])} className='bg-transparent border-none cursor-pointer'>
                        <Chip variant={(unit === units.mm || unit === units.mm_per_hr) ? "filled" : "outlined"} size='md' value="mm" />
                    </button>
                </div>
            )}

            {(prod_details['id'] == products.forecast.temp) && (
                <div className='flex gap-0 bg-white absolute z-10 top-[1rem] right-5 sm:top-[0.8rem] sm:right-[0.5rem] md:top-[1rem] md:right-[0.5rem]'>
                    <button onClick={() => onUnitChange(units.F, prod_details['id'])} className='bg-transparent border-none cursor-pointer'>
                        <Chip variant={(unit === units.F) ? "filled" : "outlined"} size='md' value="F" />
                    </button>
                    <button onClick={() => onUnitChange(units.DEG, prod_details['id'])} className='bg-transparent border-none cursor-pointer'>
                        <Chip variant={(unit === units.DEG) ? "filled" : "outlined"} size='md' value="°C" />
                    </button>
                </div>
            )}

            <div className='!absolute top-[4rem] 2xl:top-[10rem] left-[10px] z-10'>
                <img className="h-[25rem] 2xl:h-[35rem] w-auto" src={colorbar} alt="" style={{ opacity }} />
            </div>

            <div id={mapId} className='h-screen pt-2' style={{ width: "100%" }} />

            {/* Unified Card Overlay: Standardized 2-Line Output */}
            {prod_details['name'] && (() => {
                // Isolate the day token ("SUN") out of the composite state if spaces exist
                const rawDay = prod_details['day'] || displayDay || '';
                const cleanDay = rawDay.includes(' ') ? rawDay.split(' ')[0] : rawDay;

                // Build a clean time string while avoiding the generic container timestamp
                let cleanTime = '';
                if (prod_details['time'] && prod_details['time'] !== '20:26:04') {
                    cleanTime = prod_details['time'];
                } else if (rawDay.includes(' ')) {
                    cleanTime = rawDay.split(' ')[1];
                } else {
                    cleanTime = displayTime || '15:54:32';
                }

                const cleanDate = prod_details['date'] || displayDate || '12-APR-2026';

                return (
                    <div className='!absolute sm:w-48 text-center bg-white bottom-[195px] md:bottom-[80px] left-[20px] text-black border border-black shadow-md z-200 p-3 rounded-lg flex flex-col justify-center items-center font-semibold'>
                        <div className='flex flex-col text-center text-[11px] space-y-1 tracking-wide text-black w-full'>
                            <span className='font-bold uppercase text-[11px] text-black block text-center w-full'>
                                {prod_details['name']} <span className='normal-case font-normal text-black'>({unit})</span>
                            </span>

                            {radarElevation !== undefined && (
                                <span className='font-bold uppercase text-black block text-center w-full'>
                                    Elevation: {radarElevation.toFixed(1)}°
                                </span>
                            )}

                            <hr className="my-1 border-black w-full mx-auto" />

                            {/* Line 1: Day, Date */}
                            <span className='uppercase font-bold text-black block text-center w-full'>
                                {cleanDay ? `${cleanDay}, ` : ''}{cleanDate}
                            </span>

                            {/* Line 2: Time */}
                            <span className='font-mono font-bold text-black block text-center w-full'>
                                {cleanTime} UTC
                            </span>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
