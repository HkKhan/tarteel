"use strict";
/**
 * Script to extract real MFCC features from reciter audio files and update the database
 * Run with: npx ts-node scripts/extract-real-features.ts - sometimes it doesn't work so need to mv to .js then run
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
var supabase_js_1 = require("@supabase/supabase-js");
var meyda_1 = require("meyda");
var mm = require("music-metadata");
// Load audio files (using Node's FileSystem)
function loadAudioBuffer(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var buffer, metadata;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    buffer = fs_1.default.readFileSync(filePath);
                    return [4 /*yield*/, mm.parseBuffer(buffer)];
                case 1:
                    metadata = _a.sent();
                    return [2 /*return*/, { buffer: buffer, format: metadata }];
            }
        });
    });
}
// Helper function to convert an audio buffer to a mono Float32Array
function convertAudioBufferToFloat32Array(audioBuffer, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var bufferForInt16, int16View, numberOfChannels, samplesPerChannel, floatData, i, i, sum, ch;
        return __generator(this, function (_a) {
            bufferForInt16 = audioBuffer.length % 2 === 0
                ? audioBuffer
                : audioBuffer.slice(0, audioBuffer.length - 1);
            int16View = new Int16Array(new Uint8Array(bufferForInt16).buffer);
            numberOfChannels = metadata.format.numberOfChannels || 1;
            samplesPerChannel = Math.floor(int16View.length / numberOfChannels);
            floatData = new Float32Array(samplesPerChannel);
            if (numberOfChannels === 1) {
                for (i = 0; i < samplesPerChannel; i++) {
                    floatData[i] = int16View[i] / 32768.0; // Normalize to -1.0 to 1.0
                }
            }
            else { // For stereo or more channels, average them to mono
                for (i = 0; i < samplesPerChannel; i++) {
                    sum = 0;
                    for (ch = 0; ch < numberOfChannels; ch++) {
                        sum += int16View[i * numberOfChannels + ch];
                    }
                    floatData[i] = (sum / numberOfChannels) / 32768.0; // Normalize
                }
                // console.log(`[convertAudioBufferToFloat32Array] Converted ${numberOfChannels}-channel audio to mono by averaging channels. Output samples: ${floatData.length}`);
            }
            // console.log('[convertAudioBufferToFloat32Array] Finished.');
            return [2 /*return*/, floatData];
        });
    });
}
// Core reusable MFCC extraction logic from a Float32Array
function extractMFCCFromFloat32Array(concatenatedFloatData, sampleRate) {
    return __awaiter(this, void 0, void 0, function () {
        var frameSize, hopSize, mfccs, frameCount, i, startIndex, frameBuffer, currentFrame, features, result;
        return __generator(this, function (_a) {
            // console.log(`[extractMFCCFromFloat32Array] Started. Sample rate: ${sampleRate}, Total samples: ${concatenatedFloatData.length}`);
            try {
                frameSize = 1024;
                hopSize = 512;
                // Configure Meyda
                // Meyda needs a sampleRate; this is how you provide it in Node without a full Web Audio API
                meyda_1.default.audioContext = { sampleRate: sampleRate };
                meyda_1.default.bufferSize = frameSize;
                meyda_1.default.numberOfMFCCCoefficients = 13;
                mfccs = [];
                frameCount = Math.floor((concatenatedFloatData.length - frameSize) / hopSize) + 1;
                // console.log(`[extractMFCCFromFloat32Array] Processing ${frameCount} frames of audio data for MFCC extraction.`);
                for (i = 0; i < frameCount; i++) {
                    startIndex = i * hopSize;
                    frameBuffer = concatenatedFloatData.slice(startIndex, startIndex + frameSize);
                    currentFrame = frameBuffer;
                    // Pad with zeros if the frame is smaller than frameSize (typically the last frame)
                    if (frameBuffer.length < frameSize) {
                        currentFrame = new Float32Array(frameSize); // Create a zero-filled Float32Array
                        currentFrame.set(frameBuffer); // Copy data from frameBuffer to the beginning
                    }
                    try {
                        features = meyda_1.default.extract(["mfcc"], currentFrame);
                        if (features && Array.isArray(features.mfcc) && features.mfcc.every(function (val) { return !isNaN(val); })) {
                            mfccs.push(features.mfcc);
                        }
                        else if (features && features.mfcc && features.mfcc.some(isNaN)) {
                            // console.warn(`[extractMFCCFromFloat32Array] Frame ${i} produced NaN MFCCs, skipping.`);
                        }
                    }
                    catch (err) {
                        console.error("[extractMFCCFromFloat32Array] Error extracting features from frame ".concat(i, ":"), err);
                    }
                }
                if (mfccs.length === 0) {
                    // console.warn('Failed to extract any valid MFCC frames. This might be due to very short audio or processing issues.');
                    // Return empty array or handle as error, depending on requirements.
                    // For now, let's allow returning empty if no frames are good.
                    // throw new Error('Failed to extract any MFCC frames');
                }
                result = mfccs.length > 300 ? mfccs.slice(0, 300) : mfccs;
                // console.log(`[extractMFCCFromFloat32Array] Finished. Returning ${result.length} frames.`);
                return [2 /*return*/, result];
            }
            catch (err) {
                console.error('[extractMFCCFromFloat32Array] Error in MFCC extraction from Float32Array:', err);
                throw err; // Re-throw to be caught by the caller
            }
            return [2 /*return*/];
        });
    });
}
// Function to load, convert, and concatenate all 7 ayahs of Fatiha for a reciter
function getConcatenatedFatihaAudioFeatures(reciterAudioDir) {
    return __awaiter(this, void 0, void 0, function () {
        var ayahFloatDataParts, firstAyahMetadata, totalSamples, actualAyahsProcessed, i, ayahFileName, audioFilePath, audioBuffer, metadata, floatData, error_1, concatenatedFloatData, offset, _i, ayahFloatDataParts_1, part, sampleRate, features;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ayahFloatDataParts = [];
                    firstAyahMetadata = null;
                    totalSamples = 0;
                    actualAyahsProcessed = 0;
                    console.log("[getConcatenatedFatihaAudioFeatures] Processing reciter directory: ".concat(reciterAudioDir));
                    i = 1;
                    _a.label = 1;
                case 1:
                    if (!(i <= 7)) return [3 /*break*/, 7];
                    ayahFileName = "00100".concat(i, ".mp3");
                    audioFilePath = path_1.default.join(reciterAudioDir, ayahFileName);
                    if (!fs_1.default.existsSync(audioFilePath)) {
                        console.warn("[getConcatenatedFatihaAudioFeatures] Ayah file not found: ".concat(audioFilePath, ". Skipping this ayah."));
                        return [3 /*break*/, 6]; // Skip this ayah, but try to process the reciter with available ayahs
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    audioBuffer = fs_1.default.readFileSync(audioFilePath);
                    return [4 /*yield*/, mm.parseBuffer(audioBuffer)];
                case 3:
                    metadata = _a.sent();
                    // console.log(`[getConcatenatedFatihaAudioFeatures] Parsed metadata for ${audioFilePath}: SR=${metadata.format.sampleRate}, Channels=${metadata.format.numberOfChannels}, Duration=${metadata.format.duration}s`);
                    if (!metadata.format.sampleRate) {
                        console.warn("[getConcatenatedFatihaAudioFeatures] Missing sample rate for ".concat(audioFilePath, ", skipping this ayah."));
                        return [3 /*break*/, 6];
                    }
                    if (!firstAyahMetadata) {
                        firstAyahMetadata = metadata;
                    }
                    else {
                        if (firstAyahMetadata.format.sampleRate !== metadata.format.sampleRate) {
                            console.warn("[getConcatenatedFatihaAudioFeatures] Sample rate mismatch in ".concat(reciterAudioDir, ". Ayah ").concat(ayahFileName, " has ").concat(metadata.format.sampleRate, "Hz vs first ayah's ").concat(firstAyahMetadata.format.sampleRate, "Hz. Sticking to first ayah's rate for consistency."));
                        }
                        if (firstAyahMetadata.format.numberOfChannels !== metadata.format.numberOfChannels) {
                            // console.log(`Channel count mismatch for ${ayahFileName}. This is handled by mono conversion.`);
                        }
                    }
                    return [4 /*yield*/, convertAudioBufferToFloat32Array(audioBuffer, metadata)];
                case 4:
                    floatData = _a.sent();
                    // console.log(`[getConcatenatedFatihaAudioFeatures] Converted ${audioFilePath} to Float32Array, length: ${floatData.length}`);
                    if (floatData.length > 0) {
                        ayahFloatDataParts.push(floatData);
                        totalSamples += floatData.length;
                        actualAyahsProcessed++;
                    }
                    else {
                        // console.warn(`[getConcatenatedFatihaAudioFeatures] Processed floatData for ${audioFilePath} is empty, skipping.`);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error("[getConcatenatedFatihaAudioFeatures] Error processing ayah ".concat(audioFilePath, ":"), error_1);
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 1];
                case 7:
                    if (ayahFloatDataParts.length === 0 || !firstAyahMetadata || actualAyahsProcessed === 0) {
                        console.warn("[getConcatenatedFatihaAudioFeatures] No valid audio data processed for reciter in ".concat(reciterAudioDir, ". Skipping this reciter."));
                        // console.log(`[getConcatenatedFatihaAudioFeatures] Finished early due to no valid audio data.`);
                        return [2 /*return*/, null];
                    }
                    console.log("[getConcatenatedFatihaAudioFeatures] Processed ".concat(actualAyahsProcessed, " ayahs for ").concat(reciterAudioDir, ". Total samples: ").concat(totalSamples));
                    concatenatedFloatData = new Float32Array(totalSamples);
                    offset = 0;
                    for (_i = 0, ayahFloatDataParts_1 = ayahFloatDataParts; _i < ayahFloatDataParts_1.length; _i++) {
                        part = ayahFloatDataParts_1[_i];
                        concatenatedFloatData.set(part, offset);
                        offset += part.length;
                    }
                    sampleRate = firstAyahMetadata.format.sampleRate;
                    if (concatenatedFloatData.length < 1024) { // Ensure there's enough data for at least one frame
                        console.warn("[getConcatenatedFatihaAudioFeatures] Concatenated audio data for ".concat(reciterAudioDir, " is too short (").concat(concatenatedFloatData.length, " samples). Skipping MFCC extraction."));
                        // console.log(`[getConcatenatedFatihaAudioFeatures] Finished. Returning empty array due to short audio.`);
                        return [2 /*return*/, []]; // Return empty array, as no features can be extracted.
                    }
                    return [4 /*yield*/, extractMFCCFromFloat32Array(concatenatedFloatData, sampleRate)];
                case 8:
                    features = _a.sent();
                    // console.log(`[getConcatenatedFatihaAudioFeatures] Finished for ${reciterAudioDir}. Extracted ${features ? features.length : 'null'} MFCC frames.`);
                    return [2 /*return*/, features];
            }
        });
    });
}
// Calculate mean values for each MFCC coefficient across frames
function calculateMeans(mfccs) {
    if (mfccs.length === 0)
        return [];
    var numCoefficients = mfccs[0].length;
    var means = new Array(numCoefficients).fill(0);
    for (var _i = 0, mfccs_1 = mfccs; _i < mfccs_1.length; _i++) {
        var frame = mfccs_1[_i];
        for (var i = 0; i < numCoefficients; i++) {
            means[i] += frame[i];
        }
    }
    return means.map(function (sum) { return sum / mfccs.length; });
}
// Calculate standard deviation for each MFCC coefficient across frames
function calculateStdDevs(mfccs, means) {
    if (mfccs.length === 0)
        return [];
    var numCoefficients = mfccs[0].length;
    var variances = new Array(numCoefficients).fill(0);
    for (var _i = 0, mfccs_2 = mfccs; _i < mfccs_2.length; _i++) {
        var frame = mfccs_2[_i];
        for (var i = 0; i < numCoefficients; i++) {
            variances[i] += Math.pow(frame[i] - means[i], 2);
        }
    }
    return variances.map(function (variance) { return Math.sqrt(variance / mfccs.length); });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var supabaseUrl, supabaseServiceRoleKey, supabase, fatihaDir, reciterDirs, _i, reciterDirs_1, dir, reciterName, reciterAudioDirPath, featureVector, _a, reciters, fetchError, updateError, insertError, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('[main] Script started.');
                    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                    supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                    if (!supabaseUrl || !supabaseServiceRoleKey) {
                        console.error('[main] Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
                        process.exit(1);
                    }
                    console.log('[main] Supabase environment variables found.');
                    supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
                    console.log('[main] Supabase client initialized.');
                    fatihaDir = path_1.default.join(process.cwd(), 'public', 'everyayah_fatiha');
                    reciterDirs = fs_1.default.readdirSync(fatihaDir).filter(function (dir) {
                        return fs_1.default.statSync(path_1.default.join(fatihaDir, dir)).isDirectory();
                    });
                    console.log("[main] Found ".concat(reciterDirs.length, " reciter directories in ").concat(fatihaDir));
                    _i = 0, reciterDirs_1 = reciterDirs;
                    _b.label = 1;
                case 1:
                    if (!(_i < reciterDirs_1.length)) return [3 /*break*/, 11];
                    dir = reciterDirs_1[_i];
                    reciterName = dir.replace(/_/g, ' ');
                    console.log("[main] Processing reciter: ".concat(reciterName, " (from directory: ").concat(dir, ")"));
                    reciterAudioDirPath = path_1.default.join(fatihaDir, dir);
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 9, , 10]);
                    // Extract concatenated audio features for all 7 ayahs
                    console.log("[main] Extracting Fatiha features for ".concat(reciterName, " from directory ").concat(reciterAudioDirPath));
                    return [4 /*yield*/, getConcatenatedFatihaAudioFeatures(reciterAudioDirPath)];
                case 3:
                    featureVector = _b.sent();
                    if (!featureVector) {
                        console.warn("[main] No feature vector could be extracted for ".concat(reciterName, ", skipping database update."));
                        return [3 /*break*/, 10];
                    }
                    if (featureVector.length === 0) {
                        console.warn("[main] Extracted feature vector for ".concat(reciterName, " is empty (e.g. audio too short, or all frames failed). Skipping database update."));
                        return [3 /*break*/, 10];
                    }
                    console.log("[main] Successfully extracted ".concat(featureVector.length, " MFCC frames for ").concat(reciterName, "."));
                    // Get reciter from database
                    console.log("[main] Fetching reciter '".concat(reciterName, "' from database."));
                    return [4 /*yield*/, supabase
                            .from('reciters')
                            .select('id, name')
                            .eq('name', reciterName)];
                case 4:
                    _a = _b.sent(), reciters = _a.data, fetchError = _a.error;
                    if (fetchError) {
                        console.error("[main] Error fetching reciter ".concat(reciterName, ":"), fetchError);
                        return [3 /*break*/, 10];
                    }
                    console.log("[main] Fetched reciters for '".concat(reciterName, "':"), reciters);
                    if (!(reciters && reciters.length > 0)) return [3 /*break*/, 6];
                    // Update existing reciter
                    console.log("[main] Updating feature vector for existing reciter ".concat(reciterName, " (ID: ").concat(reciters[0].id, ")"));
                    return [4 /*yield*/, supabase
                            .from('reciters')
                            .update({ feature_vector: featureVector })
                            .eq('id', reciters[0].id)];
                case 5:
                    updateError = (_b.sent()).error;
                    if (updateError) {
                        console.error("[main] Error updating feature vector for ".concat(reciterName, ":"), updateError);
                    }
                    else {
                        console.log("[main] Updated feature vector for ".concat(reciterName));
                    }
                    return [3 /*break*/, 8];
                case 6:
                    // Insert new reciter if not found
                    console.log("[main] Reciter ".concat(reciterName, " not found. Inserting new reciter."));
                    return [4 /*yield*/, supabase
                            .from('reciters')
                            .insert({
                            name: reciterName,
                            feature_vector: featureVector,
                            audio_url: "/everyayah_fatiha/".concat(dir, "/001001.mp3")
                        })];
                case 7:
                    insertError = (_b.sent()).error;
                    if (insertError) {
                        console.error("[main] Error inserting reciter ".concat(reciterName, ":"), insertError);
                    }
                    else {
                        console.log("[main] Inserted new reciter ".concat(reciterName));
                    }
                    _b.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    err_1 = _b.sent();
                    console.error("[main] Error processing reciter ".concat(reciterName, " (directory: ").concat(dir, "):"), err_1);
                    return [3 /*break*/, 10];
                case 10:
                    _i++;
                    return [3 /*break*/, 1];
                case 11:
                    console.log('[main] Feature extraction and database update complete.');
                    console.log('[main] Script finished.');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('[main] Error in main process:', err);
    process.exit(1);
});
