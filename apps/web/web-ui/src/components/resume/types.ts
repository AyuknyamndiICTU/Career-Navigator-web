export interface ResumeData {
  template: string;
  sections: {
    header: {
      fullName: string | null;
      headline: string | null;
      contact: {
        phone: string | null;
        location: string | null;
        email: string | null;
        address: string | null;
        dateOfBirth: string | null;
        website: string | null;
        linkedIn: string | null;
        photoUrl: string | null;
      };
    };
    summary: string | null;
    objective: string | null;
    skills: string[];
    interests: string[];
    languages: string[];
    achievementsAwards: string[];
    activities: string[];
    publications: string[];
    signature: string | null;
    additionalInformation: string | null;
    experience: Array<{
      jobTitle: string | null;
      company: string | null;
      location: string | null;
      years: string | null;
      description: string | null;
    }>;
    education: Array<{
      degree: string | null;
      fieldOfStudy?: string | null;
      institution: string | null;
      years: string | null;
      grade?: string | null;
      description?: string | null;
    }>;
    projects: Array<{
      title: string | null;
      description: string | null;
      externalUrl: string | null;
      skills: string[];
      isCurrent: boolean;
    }>;
    references: Array<{
      name: string | null;
      relationship: string | null;
      company: string | null;
      email: string | null;
      phone: string | null;
      notes: string | null;
    }>;
    cvWizardData: unknown | null;
  };
}
