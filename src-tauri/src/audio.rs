use crate::models::{PlaybackStatus, Track, TrackSource};
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::{BufReader, Cursor};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub enum AudioCommand {
    Play(Track),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    Seek(u64),
}

#[derive(Clone)]
pub struct AudioPlayerManager {
    sender: Arc<Mutex<Sender<AudioCommand>>>,
    status: Arc<Mutex<PlaybackStatus>>,
}

impl AudioPlayerManager {
    pub fn new() -> Self {
        let (tx, rx) = channel::<AudioCommand>();
        let status = Arc::new(Mutex::new(PlaybackStatus {
            is_playing: false,
            current_time_secs: 0.0,
            duration_secs: 0,
            volume: 0.8,
            current_track: None,
        }));

        Self::spawn_audio_thread(rx, Arc::clone(&status));

        Self {
            sender: Arc::new(Mutex::new(tx)),
            status,
        }
    }

    /// Fetch online audio bytes (Audius 320kbps MP3 or YouTube Music VISIONOS M4A/AAC) natively in Rust
    fn fetch_online_audio_bytes(track: &Track) -> Result<(Vec<u8>, u64), String> {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| e.to_string())?;

        rt.block_on(async {
            let (stream_url, resolved_dur) = match track.source {
                TrackSource::YouTube => {
                    let resolved = crate::sources::youtube::resolve_youtube_music_stream(
                        &track.path_or_url,
                        &track.title,
                        &track.artist,
                    )
                    .await?;
                    let url = resolved
                        .stream_url
                        .ok_or_else(|| "Không lấy được luồng audio trực tiếp từ YouTube Music".to_string())?;
                    let dur = if resolved.duration_secs > 0 {
                        resolved.duration_secs
                    } else {
                        track.duration_secs
                    };
                    (url, dur)
                }
                TrackSource::Audius | TrackSource::SoundCloud => {
                    (track.path_or_url.clone(), track.duration_secs)
                }
                TrackSource::Local => {
                    return Err("Local track uses direct file reader".to_string());
                }
            };

            let client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15")
                .timeout(Duration::from_secs(20))
                .build()
                .map_err(|e| e.to_string())?;

            let res = client
                .get(&stream_url)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !res.status().is_success() {
                return Err(format!("HTTP stream status: {}", res.status()));
            }

            let bytes = res.bytes().await.map_err(|e| e.to_string())?;
            Ok((bytes.to_vec(), resolved_dur))
        })
    }

    fn spawn_audio_thread(rx: Receiver<AudioCommand>, thread_status: Arc<Mutex<PlaybackStatus>>) {
        thread::spawn(move || {
            let mut _stream: Option<OutputStream> = None;
            let mut sink: Option<Sink> = None;
            let mut current_track: Option<Track> = None;
            let mut volume: f32 = 0.8;
            let mut is_paused = false;
            let mut start_time: Option<Instant> = None;
            let mut elapsed_before_pause: u64 = 0;

            let init_output = |sink_opt: &mut Option<Sink>, stream_opt: &mut Option<OutputStream>, vol: f32| {
                match OutputStream::try_default() {
                    Ok((s, handle)) => {
                        *stream_opt = Some(s);
                        *sink_opt = Sink::try_new(&handle).ok();
                        if let Some(snk) = sink_opt.as_ref() {
                            snk.set_volume(vol);
                        }
                    }
                    Err(e) => {
                        eprintln!("[Spytify Audio] Output device init error: {}", e);
                    }
                }
            };

            init_output(&mut sink, &mut _stream, volume);

            loop {
                let loop_step = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    match rx.recv_timeout(Duration::from_millis(250)) {
                        Ok(AudioCommand::Play(mut track)) => {
                            if sink.is_none() {
                                init_output(&mut sink, &mut _stream, volume);
                            }
                            if let Some(s) = &sink {
                                s.stop();
                            }

                            if track.source == TrackSource::Local {
                                let file_path = &track.path_or_url;
                                if let Ok(file) = File::open(file_path) {
                                    let reader = BufReader::new(file);
                                    let decode_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                        Decoder::new(reader)
                                    }));
                                    if let Ok(Ok(source)) = decode_res {
                                        if let Some(s) = &sink {
                                            let append_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                                s.append(source);
                                                s.play();
                                            }));
                                            if append_res.is_ok() {
                                                is_paused = false;
                                                start_time = Some(Instant::now());
                                                elapsed_before_pause = 0;
                                                current_track = Some(track);
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Native Rust streaming for YouTube Music (M4A/AAC) & Audius (320k MP3)
                                match Self::fetch_online_audio_bytes(&track) {
                                    Ok((bytes, resolved_dur)) => {
                                        if resolved_dur > 0 {
                                            track.duration_secs = resolved_dur;
                                        }
                                        let cursor = Cursor::new(bytes);
                                        let decode_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                            Decoder::new(cursor)
                                        }));
                                        if let Ok(Ok(source)) = decode_res {
                                            if let Some(s) = &sink {
                                                let append_res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                                    s.append(source);
                                                    s.play();
                                                }));
                                                if append_res.is_ok() {
                                                    is_paused = false;
                                                    start_time = Some(Instant::now());
                                                    elapsed_before_pause = 0;
                                                    current_track = Some(track);
                                                }
                                            }
                                        }
                                    }
                                    Err(err) => {
                                        eprintln!("[Spytify Native Stream] Failed to stream online track in Rust: {}", err);
                                    }
                                }
                            }
                        }
                        Ok(AudioCommand::Pause) => {
                            if let Some(s) = &sink {
                                if !is_paused {
                                    s.pause();
                                    is_paused = true;
                                    if let Some(start) = start_time {
                                        elapsed_before_pause += start.elapsed().as_secs();
                                        start_time = None;
                                    }
                                }
                            }
                        }
                        Ok(AudioCommand::Resume) => {
                            if let Some(s) = &sink {
                                if is_paused {
                                    s.play();
                                    is_paused = false;
                                    start_time = Some(Instant::now());
                                }
                            }
                        }
                        Ok(AudioCommand::Stop) => {
                            if let Some(s) = &sink {
                                s.stop();
                            }
                            current_track = None;
                            is_paused = false;
                            start_time = None;
                            elapsed_before_pause = 0;
                        }
                        Ok(AudioCommand::SetVolume(new_vol)) => {
                            let clamped = new_vol.clamp(0.0, 1.0);
                            volume = clamped;
                            if let Some(s) = &sink {
                                s.set_volume(clamped);
                            }
                        }
                        Ok(AudioCommand::Seek(position_secs)) => {
                            if let Some(s) = &sink {
                                let dur = Duration::from_secs(position_secs);
                                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                    let _ = s.try_seek(dur);
                                }));
                                elapsed_before_pause = position_secs;
                                if !is_paused {
                                    start_time = Some(Instant::now());
                                }
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                            return false;
                        }
                    }

                    let is_playing = sink.as_ref().map(|s| !s.is_paused() && !s.empty()).unwrap_or(false);
                    let mut current_time_secs: f64 = elapsed_before_pause as f64;
                    if is_playing {
                        if let Some(start) = start_time {
                            current_time_secs += start.elapsed().as_secs_f64();
                        }
                    }

                    let duration = current_track.as_ref().map(|t| t.duration_secs).unwrap_or(0);

                    if let Ok(mut st) = thread_status.lock() {
                        st.is_playing = is_playing;
                        st.current_time_secs = current_time_secs.min(duration.max(1) as f64);
                        st.duration_secs = duration;
                        st.volume = volume;
                        st.current_track = current_track.clone();
                    }

                    true
                }));

                match loop_step {
                    Ok(should_continue) => {
                        if !should_continue {
                            break;
                        }
                    }
                    Err(panic_err) => {
                        eprintln!("[Spytify Audio] Caught panic in audio thread: {:?}", panic_err);
                        sink = None;
                        _stream = None;
                        init_output(&mut sink, &mut _stream, volume);
                    }
                }
            }
        });
    }

    fn send_command(&self, cmd: AudioCommand) -> Result<(), String> {
        let mut sender_guard = self.sender.lock().map_err(|e| e.to_string())?;
        if let Err(_) = sender_guard.send(cmd.clone()) {
            let (new_tx, new_rx) = channel::<AudioCommand>();
            Self::spawn_audio_thread(new_rx, Arc::clone(&self.status));
            *sender_guard = new_tx;
            sender_guard.send(cmd).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn play(&self, track: Track) -> Result<(), String> {
        self.send_command(AudioCommand::Play(track))
    }

    pub fn pause(&self) -> Result<(), String> {
        self.send_command(AudioCommand::Pause)
    }

    pub fn resume(&self) -> Result<(), String> {
        self.send_command(AudioCommand::Resume)
    }

    pub fn stop(&self) -> Result<(), String> {
        self.send_command(AudioCommand::Stop)
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send_command(AudioCommand::SetVolume(volume))
    }

    pub fn seek(&self, position_secs: u64) -> Result<(), String> {
        self.send_command(AudioCommand::Seek(position_secs))
    }

    pub fn get_status(&self) -> PlaybackStatus {
        self.status.lock().map(|st| st.clone()).unwrap_or(PlaybackStatus {
            is_playing: false,
            current_time_secs: 0.0,
            duration_secs: 0,
            volume: 0.8,
            current_track: None,
        })
    }
}
