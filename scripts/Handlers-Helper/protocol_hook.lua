-- Simple Protocol Hook for MPV - No Base64 encoding needed
-- Uses simple query parameters: mpv://action/?url=...&referer=...

local utils = require 'mp.utils'
local msg = require 'mp.msg'
local opts = require "mp.options"

local options = {
    cwd = '',
    proxy = '',
    stream_quality = 'best',
}

opts.read_options(options, "protocol_hook")

local cwd = options.cwd
local proxy = options.proxy
local stream_quality = options.stream_quality

if proxy == '' then
    proxy = false
end

local function getOS()
    local BinaryFormat = package.cpath
    if BinaryFormat:match("dll$") then
        return "Windows"
    elseif BinaryFormat:match("so$") then
        if BinaryFormat:match("homebrew") then
            return "MacOS"
        else
            return "Linux"
        end
    elseif BinaryFormat:match("dylib$") then
        return "MacOS"
    end
end

local osv = getOS()

if cwd == '' then
    if osv == 'MacOS' then
        cwd = '/Users/' .. os.getenv('USER') .. '/.config/mpv'
    else
        cwd = mp.command_native({'expand-path', '~~home/'})
    end
end

local function url_decode(str)
    if not str then return "" end
    
    str = str:gsub('+', ' ')
    str = str:gsub('%%(%x%x)', function(h)
        return string.char(tonumber(h, 16))
    end)
    
    return str
end

local function parse_query_string(query)
    local params = {}
    if not query then return params end
    
    for key, value in query:gmatch("([^&=]+)=([^&]*)") do
        params[key] = url_decode(value)
    end
    
    return params
end

local function livestreamer(url, referer, proxy, hls)
    print('Streamlink: ' .. url)
    
    local cmd = 'run streamlink "' .. url .. '" ' .. stream_quality
    
    -- Add config if exists
    local config_path = cwd .. '/streamlink.conf'
    cmd = cmd .. ' --config=' .. config_path
    
    -- Add HLS options if needed
    if hls then
        cmd = cmd .. ' --player-args=--demuxer-lavf-format=mpegts'
    end
    
    -- Add proxy if configured
    if proxy and proxy ~= '' then
        cmd = cmd .. ' --http-proxy=' .. proxy
    end
    
    -- Add referer if provided
    if referer and referer ~= '' then
        cmd = cmd .. ' --http-header=Referer=' .. referer
    end
    
    print("Running: " .. cmd)
    
    mp.command(cmd)
end

local function ytdl(url, referer, mode)
    print('YT-DLP: ' .. url)
    
    local args = {'yt-dlp'}
    
    if mode == 'audio' then
        table.insert(args, '-f')
        table.insert(args, 'ba')
        table.insert(args, '--extract-audio')
    end
    
    table.insert(args, url)
    
    print("Running: " .. table.concat(args, " "))
    
    mp.command_native({
        name = "run", 
        args = args,
        playbook_only = false,
    })
end

local function direct_play(url, referer)
    print('Direct play: ' .. url)
    
    if referer and referer ~= '' then
        mp.commandv('set', 'http-header-fields', 'Referer: ' .. referer)
    end
    
    mp.commandv('loadfile', url, 'replace')
end

mp.add_hook("on_load", 1, function()
    local ourl = mp.get_property("stream-open-filename", "")
    local url = ourl
    
    -- Add protocol prefix on macOS if needed
    if osv == 'MacOS' and not url:find("mpv://") then
        url = 'mpv://' .. url
    end
    
    if not url:find("mpv://") then
        print("not a mpv url: " .. url)
        return
    end
    
    print('Protocol hook processing: ' .. url)
    
    -- Parse URL: mpv://action/?query_string or mpv:///action/?query_string
    local pattern1 = "mpv://([^/?]+)/%??(.*)"
    local pattern2 = "mpv:///([^/?]+)/%??(.*)"
    local action, query_string = url:match(pattern1)
    
    if not action then
        action, query_string = url:match(pattern2)
    end
    
    if not action then
        print("Failed to parse action from URL")
        return
    end
    
    print('Action: ' .. action)
    print('Query: ' .. (query_string or 'none'))
    
    -- Parse query parameters
    local params = parse_query_string(query_string)
    
    local target_url = params['url']
    if not target_url then
        print("No URL parameter found")
        return
    end
    
    print('Target URL: ' .. target_url)
    
    local referer = params['referer'] or ''
    local hls = params['hls'] == '1'
    
    if referer ~= '' then
        print('Referer: ' .. referer)
    end
    
    if hls then
        print('HLS mode enabled')
    end
    
    -- Handle actions
    if action == 'stream' then
        livestreamer(target_url, referer, proxy, hls)
    elseif action == 'ytdl' then
        ytdl(target_url, referer, 'video')
    elseif action == 'play' or action == 'mpvy' then
        direct_play(target_url, referer)
    elseif action == 'list' then
        -- IPTV/playlist mode - for now just direct play
        direct_play(target_url, referer)
    else
        print('Unknown action: ' .. action)
    end
end)

print("Simple Protocol Hook loaded successfully")
