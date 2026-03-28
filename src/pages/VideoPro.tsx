<div className="flex h-screen bg-[#050509] text-white">

  {/* SIDEBAR */}
  <div className="w-64 bg-[#0b0b12] border-r border-[#262637] p-4 flex flex-col gap-4">
    <div className="text-lg font-semibold">Nexus AI</div>

    <div className="flex flex-col gap-2 text-sm">
      <button className="text-left p-2 rounded hover:bg-[#151521]">🎬 Video</button>
      <button className="text-left p-2 rounded hover:bg-[#151521]">🖼 Image</button>
      <button className="text-left p-2 rounded hover:bg-[#151521]">🧑 Avatar</button>
      <button className="text-left p-2 rounded hover:bg-[#151521]">📁 History</button>
    </div>
  </div>

  {/* MAIN */}
  <div className="flex-1 flex flex-col">

    {/* TOPBAR */}
    <div className="h-14 border-b border-[#262637] flex items-center px-6">
      <div className="text-sm text-gray-400">Video Generator</div>
    </div>

    {/* CONTENT */}
    <div className="flex-1 flex">

      {/* LEFT PANEL */}
      <div className="w-[420px] border-r border-[#262637] p-6 flex flex-col gap-4">

        <textarea
          className="w-full h-32 bg-[#0b0b12] border border-[#262637] rounded-lg p-3"
          placeholder="Describe your video..."
        />

        <div className="grid grid-cols-2 gap-3">
          <select className="bg-[#0b0b12] border p-2 rounded">
            <option>Cinematic</option>
          </select>

          <select className="bg-[#0b0b12] border p-2 rounded">
            <option>10s</option>
          </select>
        </div>

        <div className="flex gap-2">
          <input type="file" />
          <input type="file" />
        </div>

        <button className="bg-purple-600 p-3 rounded-lg">
          Generate Video
        </button>

      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-6">

        <div className="w-full max-w-2xl aspect-video bg-[#0b0b12] border border-[#262637] rounded-xl flex items-center justify-center text-gray-500">
          Video Preview
        </div>

      </div>

    </div>
  </div>
</div>
