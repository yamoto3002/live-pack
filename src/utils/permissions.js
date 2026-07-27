export function canViewNote(user,note,shareScope=null){
 if(note.visibility==='public')return true;
 if(shareScope){if(note.visibility==='staff')return shareScope==='staff';if(note.visibility==='band')return shareScope==='band';if(note.visibility==='role')return note.targetRole===shareScope;if(note.visibility==='bandmaster')return shareScope==='bandmaster';return false}
 if(!user)return false;
 if(note.visibility==='private')return note.authorUserId===user.id;
 if(note.visibility==='role')return note.targetRole===user.role;
 if(note.visibility==='staff')return user.role==='staff';
 if(note.visibility==='bandmaster')return user.permissions?.includes('admin');
 if(note.visibility==='band')return user.permissions?.includes('band_member');
 return false;
}
export const visibleNotes=(notes,user,scope)=>notes.filter(n=>canViewNote(user,n,scope));
