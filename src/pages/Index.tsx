import ImagePro from "@/components/ImagePro";

const Index = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">🔥 IMAGE PRO AI</h1>

        <p className="text-gray-400 mb-8">Generator obrazów AI — generuj grafikę, logo, produkty, bannery i więcej.</p>

        <ImagePro />
      </div>
    </div>
  );
};

export default Index;
