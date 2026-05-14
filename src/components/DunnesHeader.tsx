import logo from "@/assets/dunnes-logo.jpeg";

const DunnesHeader = () => {
  return (
    <div className="text-center border-b-2 border-primary pb-2 mb-4">
      {/* Logo aapka upar hi rahega */}
      <img src={logo} alt="Dunne's Institute Logo" className="w-16 h-16 mx-auto mb-1" />
      
      <h1 className="text-3xl font-black text-primary uppercase leading-tight">DUNNE'S INSTITUTE</h1>
      
      {/* Behramgore Foundation wali line */}
      <p className="text-[10px] font-bold text-primary/90 leading-tight italic">
        (Behramgore Anklesaria Education Foundation)
      </p>
      
      {/* Address aur Contact Number - Yahan aap number change kar sakti hain */}
      <p className="text-[9px] font-medium text-primary/80">
        Admiralty House, Wodehouse Road, Colaba, Mumbai - 400 005 | Contact: 7020981168
      </p>
      
      <p className="text-[10px] font-black text-primary tracking-widest uppercase mt-0.5">
        RECOGNISED I.C.S.E. SCHOOL
      </p>
      
      {/* Progress Report Banner */}
      <div className="mt-2 bg-primary text-primary-foreground py-0.5 px-6 inline-block rounded-full font-bold text-[11px]">
        Progress Report for the Academic year 2026-27
      </div>
    </div>
  );
};

export default DunnesHeader;