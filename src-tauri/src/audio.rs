use crate::models::{PlaybackStatus, Track};
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug)]
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
    sender: Sender<AudioCommand>,
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

        let thread_status = Arc::clone(&status);

        // Dedicated audio thread to ensure thread safety & zero audio lag on Windows
        thread::spawn(move || {
            let mut _stream: Option<OutputStream> = None;
            let mut sink: Option<Sink> = None;
            let mut current_track: Option<Track> = None;
            let mut volume: f32 = 0.8;
            let mut is_paused = false;
            let mut start_time: Option<Instant> = None;
            let mut elapsed_before_pause: u64 = 0;

            // Initialize audio device on this thread
            match OutputStream::try_default() {
                Ok((s, handle)) => {
                    _stream = Some(s);
                    sink = Sink::try_new(&handle).ok();
                    if let Some(s) = &sink {
                        s.set_volume(volume);
                    }
                }
                Err(e) => {
                    eprintln!("[Nutify Audio] Output device init error: {}", e);
                }
            }

            loop {
                // Check for incoming commands (non-blocking with timeout so we can update elapsed time)
                match rx.recv_timeout(Duration::from_millis(250)) {
                    Ok(AudioCommand::Play(track)) => {
                        if let Some(s) = &sink {
                            s.stop();
                        }
                        if let Some(s) = &sink {
                            let file_path = &track.path_or_url;
                            if let Ok(file) = File::open(file_path) {
                                let reader = BufReader::new(file);
                                if let Ok(source) = Decoder::new(reader) {
                                    s.append(source);
                                    s.play();
                                    is_paused = false;
                                    start_time = Some(Instant::now());
                                    elapsed_before_pause = 0;
                                    current_track = Some(track);
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
                            let _ = s.try_seek(dur);
                            elapsed_before_pause = position_secs;
                            if !is_paused {
                                start_time = Some(Instant::now());
                            }
                        }
                    }
                    Err(_) => {
                        // Timeout reached, update playback status
                    }
                }

                // Update shared status with f64 precision
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
            }
        });

        Self {
            sender: tx,
            status,
        }
    }

    pub fn play(&self, track: Track) -> Result<(), String> {
        self.sender
            .send(AudioCommand::Play(track))
            .map_err(|e| e.to_string())
    }

    pub fn pause(&self) -> Result<(), String> {
        self.sender
            .send(AudioCommand::Pause)
            .map_err(|e| e.to_string())
    }

    pub fn resume(&self) -> Result<(), String> {
        self.sender
            .send(AudioCommand::Resume)
            .map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.sender
            .send(AudioCommand::Stop)
            .map_err(|e| e.to_string())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.sender
            .send(AudioCommand::SetVolume(volume))
            .map_err(|e| e.to_string())
    }

    pub fn seek(&self, position_secs: u64) -> Result<(), String> {
        self.sender
            .send(AudioCommand::Seek(position_secs))
            .map_err(|e| e.to_string())
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
